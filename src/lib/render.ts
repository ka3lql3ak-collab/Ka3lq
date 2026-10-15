import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, now, parseJson } from "./db";
import { mediaDir, newId, toRel, fromRel } from "./paths";
import { registerHandler, enqueue, type JobContext } from "./jobs";
import { ffmpeg, probe, type ProbeInfo } from "./media/ffmpeg";
import { sfxFile, generateMusicBed, moodForGenre } from "./media/sfx";
import { matchSfx } from "./media/sfx-names";
import { buildTimeline, captionCues, toAss, toSrt, toVtt, type Timeline } from "./media/timeline";
import { escapeFilterPath } from "./media/tts";
import { getSettings } from "./settings";
import { getAsset, listAssets, listScenes, requireProject, createAsset, NotFoundError, ValidationError, ConflictError } from "./repo";
import { generateVoices, getEditorOptions, projectVoiceLines, resolveEditStyle } from "./features/voice";
import { log, redact } from "./log";

export type Quality = "preview" | "final";

export interface RenderRow {
  id: string;
  project_id: string;
  quality: Quality;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  path: string | null;
  captions_path: string | null;
  is_demo: number;
  approval: "pending" | "approved" | "rejected";
  options_json: string;
  duration_sec: number | null;
  error: string | null;
  log: string | null;
  job_id: string | null;
  created_at: number;
  updated_at: number;
}

export function renderView(r: RenderRow) {
  const opts = parseJson<Record<string, unknown>>(r.options_json, {});
  return {
    id: r.id,
    projectId: r.project_id,
    quality: r.quality,
    status: r.status,
    progress: r.progress,
    url: r.path ? `/api/media/${r.path.split("/").map(encodeURIComponent).join("/")}` : null,
    srtUrl: opts.srt ? `/api/media/${String(opts.srt)}` : null,
    vttUrl: opts.vtt ? `/api/media/${String(opts.vtt)}` : null,
    isDemo: !!r.is_demo,
    approval: r.approval,
    durationSec: r.duration_sec,
    error: r.error,
    log: r.log,
    warnings: (opts.warnings as string[]) ?? [],
    width: opts.width as number | undefined,
    height: opts.height as number | undefined,
    jobId: r.job_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
export type RenderView = ReturnType<typeof renderView>;

const SIZES: Record<Quality, { w: number; h: number; crf: number; preset: string }> = {
  preview: { w: 540, h: 960, crf: 28, preset: "veryfast" },
  final: { w: 1080, h: 1920, crf: 19, preset: "medium" },
};
const FPS = 30;

function setRender(id: string, f: Partial<Record<string, unknown>>) {
  const keys = Object.keys(f);
  db()
    .prepare(`UPDATE renders SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => f[k] as never), now(), id);
}

export function getRender(id: string) {
  const r = db().prepare("SELECT * FROM renders WHERE id = ?").get(id) as RenderRow | undefined;
  return r ? renderView(r) : null;
}

export function listRenders(f: { projectId?: string; limit?: number } = {}) {
  const rows = f.projectId
    ? (db().prepare("SELECT * FROM renders WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all(f.projectId, f.limit ?? 50) as RenderRow[])
    : (db().prepare("SELECT * FROM renders ORDER BY created_at DESC LIMIT ?").all(f.limit ?? 100) as RenderRow[]);
  return rows.map(renderView);
}

/** Check what's needed before rendering; returns blocking problems and warnings. */
export function renderReadiness(projectId: string, quality: Quality) {
  const opts = getEditorOptions(projectId);
  const scenes = listScenes(projectId);
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!scenes.length) problems.push("The project has no scenes.");
  const included = scenes.filter((s) => s.approval === "approved" || (quality === "preview" && opts.includeUnapproved && s.clipAssetId));
  for (const s of scenes) {
    if (!s.clipAssetId) problems.push(`Scene ${s.idx + 1} has no clip.`);
    else if (s.approval !== "approved") {
      if (quality === "final") problems.push(`Scene ${s.idx + 1}'s clip isn't approved.`);
      else if (!opts.includeUnapproved) problems.push(`Scene ${s.idx + 1}'s clip isn't approved (approve it, or allow unapproved clips in previews).`);
      else warnings.push(`Scene ${s.idx + 1} is included in this preview without approval.`);
    }
  }
  const demo = included.some((s) => getAsset(s.clipAssetId!)?.isDemo);
  if (demo) warnings.push("Includes DEMO placeholder clips. The video will be watermarked and labelled as a demo.");
  const missingRec = projectVoiceLines(projectId).flatMap((s) => s.lines).filter((l) => l.needsRecording);
  if (missingRec.length) warnings.push(`${missingRec.length} line(s) use recorded voices that haven't been recorded yet; they'll be silent.`);
  if (opts.music === "upload" && (!opts.musicAssetId || !opts.musicLicenseConfirmed)) problems.push("Imported music needs a file and your confirmation that you have the rights to use it.");
  return { ok: problems.length === 0, problems, warnings, includedSceneIds: included.map((s) => s.id), demo };
}

export function queueRender(projectId: string, quality: Quality) {
  requireProject(projectId);
  const ready = renderReadiness(projectId, quality);
  if (!ready.ok) throw new ValidationError(ready.problems.join(" "));
  const active = db().prepare("SELECT id FROM renders WHERE project_id = ? AND status IN ('queued','running')").get(projectId);
  if (active) throw new ConflictError("A render for this project is already in progress.");
  const id = newId("r_");
  db()
    .prepare("INSERT INTO renders(id,project_id,quality,status,is_demo,options_json,created_at,updated_at) VALUES (?,?,?,'queued',?,?,?,?)")
    .run(id, projectId, quality, ready.demo ? 1 : 0, JSON.stringify({ warnings: ready.warnings }), now(), now());
  const job = enqueue("render", { renderId: id }, projectId);
  setRender(id, { job_id: job.id });
  return getRender(id)!;
}

/** Fit any clip into W×H without stretching or cropping the subject: blurred fill behind letterboxed footage. */
export function fitFilter(info: ProbeInfo, w: number, h: number, dur: number, opts: { pushIn?: number } = {}) {
  const ar = (info.width ?? w) / (info.height ?? h);
  const target = w / h;
  // Optional slow push-in across the whole shot (keeps static or AI shots feeling alive).
  const frames = Math.max(1, Math.round(dur * FPS));
  const push = opts.pushIn ? `,zoompan=z='1+${opts.pushIn}*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${FPS}` : "";
  const conform = `setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=${(dur + 1).toFixed(3)},trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS${push},format=yuv420p`;
  if (Math.abs(ar - target) / target < 0.03) return `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},${conform}[v]`;
  return `[0:v]split=2[a][b];[a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=luma_radius=${Math.round(w / 27)}:luma_power=2,eq=brightness=-0.08:saturation=1.1[bg];[b]scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,${conform}[v]`;
}

async function doRender(ctx: JobContext) {
  const renderId = String(ctx.job.payload.renderId);
  const row = db().prepare("SELECT * FROM renders WHERE id = ?").get(renderId) as RenderRow | undefined;
  if (!row) throw new NotFoundError("Render not found");
  const logLines: string[] = [];
  const note = (m: string) => {
    logLines.push(m);
    setRender(renderId, { log: logLines.join("\n") });
  };
  const step = (p: number, m: string) => {
    ctx.progress(p, m);
    setRender(renderId, { progress: p, status: "running" });
    note(m);
  };
  const projectId = row.project_id;
  const quality = row.quality;
  const { w, h, crf, preset } = SIZES[quality];
  const s = getSettings();
  const project = requireProject(projectId);
  const editor = getEditorOptions(projectId);
  const work = mediaDir("projects", projectId, "renders", renderId);
  try {
    const ready = renderReadiness(projectId, quality);
    if (!ready.ok) throw new ValidationError(ready.problems.join(" "));

    step(0.03, "Generating missing voice lines (free, local)…");
    await generateVoices(projectId, (p, m) => ctx.progress(0.03 + p * 0.12, m));

    const editStyle = resolveEditStyle(editor.editStyle, project.settings.genre);
    const punchy = editStyle === "punchy";
    const transition = punchy ? "cut" : s.render.transition;
    note(`Edit style: ${punchy ? "punchy (hard cuts, push-ins, cut whooshes, word-highlight captions, hook title)" : `cinematic (${transition})`}.`);
    const scenes = listScenes(projectId).filter((sc) => ready.includedSceneIds.includes(sc.id));
    const voice = projectVoiceLines(projectId);
    step(0.16, "Checking clips…");
    const clips: { abs: string; info: ProbeInfo; isDemo: boolean }[] = [];
    for (const sc of scenes) {
      const a = getAsset(sc.clipAssetId!);
      if (!a) throw new ValidationError(`Scene ${sc.idx + 1}: its clip file record is missing.`);
      const abs = fromRel(a.path);
      if (!fs.existsSync(abs)) throw new ValidationError(`Scene ${sc.idx + 1}: clip file is missing on disk (${a.path}). Regenerate or re-import it.`);
      let info: ProbeInfo;
      try {
        info = await probe(abs);
      } catch (e) {
        throw new ValidationError(`Scene ${sc.idx + 1}: clip is unreadable or corrupted — ${(e as Error).message}`);
      }
      if (!info.hasVideo || info.durationSec < 0.3) throw new ValidationError(`Scene ${sc.idx + 1}: clip has no usable video.`);
      if ((info.height ?? 0) < h && quality === "final") note(`Scene ${sc.idx + 1}: source is ${info.width}×${info.height}; upscaled to ${w}×${h}.`);
      clips.push({ abs, info, isDemo: a.isDemo });
    }

    const tl: Timeline = buildTimeline(
      scenes.map((sc) => ({
        id: sc.id,
        idx: sc.idx,
        durationSec: sc.durationSec,
        caption: sc.caption,
        sfx: sc.sfx.map((x) => matchSfx(x)).filter((x): x is NonNullable<typeof x> => !!x),
        lines: (voice.find((v) => v.sceneId === sc.id)?.lines ?? []).map((l) => ({ text: l.text, speaker: l.speaker, durationSec: l.asset ? Number(l.durationSec ?? 0) : 0, file: l.asset ? fromRel(l.asset.path) : null })),
      })),
      transition,
      s.render.transitionSec,
    );
    tl.warnings.forEach(note);
    // Punchy edits: a whoosh lands on every cut.
    if (punchy) for (let i = 1; i < tl.scenes.length; i++) tl.scenes[i].sfx.unshift({ name: "whoosh", atSec: Math.max(0, tl.scenes[i].startSec - 0.18) });

    // 1. Normalise each clip into a segment of exactly its timeline duration.
    const segs: string[] = [];
    for (let i = 0; i < tl.scenes.length; i++) {
      if (ctx.isCancelled()) throw new Error("Render cancelled");
      const seg = path.join(work, `seg-${i}.mp4`);
      step(0.18 + (0.32 * i) / tl.scenes.length, `Conforming scene ${tl.scenes[i].idx + 1} to ${w}×${h} @ ${FPS}fps…`);
      await ffmpeg(["-loglevel", "error", "-i", clips[i].abs, "-filter_complex", fitFilter(clips[i].info, w, h, tl.scenes[i].durationSec, punchy ? { pushIn: i % 2 === 0 ? 0.08 : 0.06 } : {}), "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", String(Math.max(16, crf - 4)), "-r", String(FPS), seg]);
      segs.push(seg);
    }

    // 2. Join with transitions.
    step(0.52, `Joining ${segs.length} scenes (${transition})…`);
    const joined = path.join(work, "joined.mp4");
    if (segs.length === 1 || tl.transitionSec === 0) {
      const list = path.join(work, "list.txt");
      fs.writeFileSync(list, segs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
      await ffmpeg(["-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
    } else {
      const kind = transition === "fadeblack" ? "fadeblack" : "fade";
      let chain = "";
      let last = "[0:v]";
      for (let i = 1; i < segs.length; i++) {
        const out = i === segs.length - 1 ? "[v]" : `[x${i}]`;
        chain += `${last}[${i}:v]xfade=transition=${kind}:duration=${tl.transitionSec.toFixed(3)}:offset=${tl.scenes[i].startSec.toFixed(3)}${out};`;
        last = out;
      }
      await ffmpeg(["-loglevel", "error", ...segs.flatMap((f) => ["-i", f]), "-filter_complex", chain.replace(/;$/, ""), "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", String(Math.max(16, crf - 4)), joined]);
    }

    // 3. Audio: voices, SFX, music (ducked under speech), loudness-normalised.
    step(0.62, "Mixing voice, sound effects and music…");
    const mix = path.join(work, "mix.wav");
    const inputs: string[] = ["-f", "lavfi", "-t", tl.totalSec.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"];
    const parts: string[] = [];
    const voiceLabels: string[] = [];
    const sfxLabels: string[] = [];
    let n = 1;
    for (const sc of tl.scenes)
      for (const l of sc.lines) {
        if (!l.file) continue;
        inputs.push("-i", l.file);
        parts.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(l.atSec * 1000)}:all=1,volume=${s.render.voiceVolume.toFixed(2)}[vo${n}]`);
        voiceLabels.push(`[vo${n}]`);
        n++;
      }
    for (const sc of tl.scenes)
      for (const x of sc.sfx) {
        const file = await sfxFile(x.name as never);
        inputs.push("-i", file);
        parts.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(x.atSec * 1000)}:all=1,volume=${(0.55 * s.render.sfxVolume).toFixed(2)}[sx${n}]`);
        sfxLabels.push(`[sx${n}]`);
        n++;
      }
    let musicFile: string | null = null;
    if (editor.music === "generated") {
      musicFile = path.join(work, "music.wav");
      await generateMusicBed(editor.mood === "auto" ? moodForGenre(project.settings.genre) : editor.mood, tl.totalSec, musicFile);
      note("Music: original generated bed (royalty-free).");
    } else if (editor.music === "upload" && editor.musicAssetId) {
      const m = getAsset(editor.musicAssetId);
      if (!m) throw new ValidationError("The selected music file is missing.");
      musicFile = fromRel(m.path);
      note(`Music: imported file (rights confirmed by you).`);
    }
    const mixIns = ["[0:a]"];
    if (voiceLabels.length) {
      parts.push(`${voiceLabels.join("")}amix=inputs=${voiceLabels.length}:normalize=0:dropout_transition=0,asplit=2[voice][vkey]`);
      mixIns.push("[voice]");
    }
    if (sfxLabels.length) {
      parts.push(`${sfxLabels.join("")}amix=inputs=${sfxLabels.length}:normalize=0:dropout_transition=0[sfx]`);
      mixIns.push("[sfx]");
    }
    if (musicFile) {
      inputs.push("-stream_loop", "-1", "-i", musicFile);
      parts.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${tl.totalSec.toFixed(3)},volume=${s.render.musicVolume.toFixed(2)}[mus]`);
      if (voiceLabels.length) parts.push(`[mus][vkey]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck]`);
      mixIns.push(voiceLabels.length ? "[duck]" : "[mus]");
      n++;
    } else if (voiceLabels.length) parts.push(`[vkey]anullsink`);
    const fades = s.render.fadeInOut ? `,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, tl.totalSec - 0.6).toFixed(3)}:d=0.6` : "";
    parts.push(`${mixIns.join("")}amix=inputs=${mixIns.length}:normalize=0:dropout_transition=0,atrim=0:${tl.totalSec.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11${fades},aresample=48000[out]`);
    await ffmpeg(["-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", "-ac", "2", "-ar", "48000", mix]);

    // 4. Captions.
    const cues = captionCues(tl, s.render.captions ? editor.captions : "off");
    const ass = path.join(work, "captions.ass");
    const hookText = (scenes[0]?.caption || project.story?.hook || "").replace(/[.…!]+$/, "");
    const hook = punchy && s.render.captions && hookText && hookText.split(/\s+/).length <= 8 ? { text: hookText, start: 0.1, end: Math.min(2.6, tl.scenes[0]?.durationSec ?? 2.6) } : null;
    // When the hook title is on screen, don't also show the same words as a caption.
    const shownCues = hook ? cues.filter((c) => !(c.start < hook.end && c.text.replace(/[.…!]+$/, "").toLowerCase() === hookText.toLowerCase())) : cues;
    fs.writeFileSync(ass, toAss(shownCues, { width: w, height: h, fontSize: s.render.captionSize, karaoke: punchy, hook }));
    const srt = path.join(work, "captions.srt");
    const vtt = path.join(work, "captions.vtt");
    fs.writeFileSync(srt, toSrt(cues));
    fs.writeFileSync(vtt, toVtt(cues));

    // 5. Final encode: H.264 + AAC, faststart.
    step(0.7, `Encoding final ${w}×${h} H.264/AAC…`);
    const out = path.join(work, `${quality}.mp4`);
    const vf: string[] = [];
    if (cues.length) vf.push(`ass=${escapeFilterPath(ass)}`);
    if (s.render.fadeInOut) vf.push(`fade=t=in:st=0:d=0.35`, `fade=t=out:st=${Math.max(0, tl.totalSec - 0.5).toFixed(3)}:d=0.5`);
    if (row.is_demo) vf.push(`drawtext=font='Inter':text='DEMO — NOT AI VIDEO':fontcolor=0xFFD36A@0.9:fontsize=${Math.round(h / 48)}:box=1:boxcolor=black@0.5:boxborderw=10:x=w-tw-24:y=h-th-24`);
    vf.push("format=yuv420p");
    await ffmpeg(
      ["-loglevel", "info", "-stats", "-i", joined, "-i", mix, "-map", "0:v", "-map", "1:a", "-vf", vf.join(","), "-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-profile:v", "high", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", tl.totalSec.toFixed(3), out],
      {
        onStderr: (line) => {
          const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(line);
          if (m) ctx.progress(0.7 + 0.28 * Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / tl.totalSec), "Encoding…");
        },
      },
    );

    // 6. Verify the result.
    const info = await probe(out);
    if (!info.hasVideo || !info.hasAudio) throw new Error("Rendered file is missing a video or audio stream.");
    if (Math.abs(info.durationSec - tl.totalSec) > 0.6) throw new Error(`Rendered duration ${info.durationSec.toFixed(2)}s doesn't match the timeline (${tl.totalSec.toFixed(2)}s).`);
    for (const f of [...segs, joined, mix]) fs.rmSync(f, { force: true });
    if (musicFile && musicFile.startsWith(work)) fs.rmSync(musicFile, { force: true });
    note(`Done: ${info.width}×${info.height}, ${info.durationSec.toFixed(2)}s, ${info.videoCodec}/${info.audioCodec}.`);
    const prev = parseJson<Record<string, unknown>>(row.options_json, {});
    setRender(renderId, {
      status: "done",
      progress: 1,
      path: toRel(out),
      captions_path: toRel(srt),
      duration_sec: info.durationSec,
      options_json: JSON.stringify({ ...prev, warnings: [...((prev.warnings as string[]) ?? []), ...tl.warnings], srt: toRel(srt), vtt: toRel(vtt), width: info.width, height: info.height, timeline: tl }),
      error: null,
    });
    return { renderId, durationSec: info.durationSec };
  } catch (e) {
    const msg = redact(e);
    note(`Failed: ${msg}`);
    setRender(renderId, { status: ctx.isCancelled() ? "cancelled" : "failed", error: msg });
    log.error(`render ${renderId} failed`, msg);
    throw e;
  }
}

export function setRenderApproval(projectId: string, renderId: string, approval: "approved" | "rejected" | "pending") {
  const r = getRender(renderId);
  if (!r || r.projectId !== projectId) throw new NotFoundError("Render not found");
  if (approval === "approved" && r.status !== "done") throw new ValidationError("Only finished renders can be approved.");
  setRender(renderId, { approval });
  return getRender(renderId)!;
}

/** Extract candidate cover frames from a finished render at the suggested moments. */
export async function extractCovers(projectId: string, renderId: string, times: number[]) {
  const r = getRender(renderId);
  if (!r || r.projectId !== projectId || r.status !== "done" || !r.url) throw new ValidationError("Render a video first.");
  const row = db().prepare("SELECT path FROM renders WHERE id = ?").get(renderId) as { path: string };
  const src = fromRel(row.path);
  for (const a of listAssets({ projectId, kind: "cover" })) if (a.meta.renderId === renderId) return listAssets({ projectId, kind: "cover" }).filter((x) => x.meta.renderId === renderId);
  const dir = mediaDir("projects", projectId, "covers");
  const out = [];
  for (const t of times.slice(0, 4)) {
    const at = Math.max(0, Math.min((r.durationSec ?? 1) - 0.1, t));
    const file = path.join(dir, `cover-${renderId}-${Math.round(at * 10)}.jpg`);
    await ffmpeg(["-loglevel", "error", "-ss", at.toFixed(2), "-i", src, "-frames:v", "1", "-q:v", "2", file]);
    out.push(createAsset({ projectId, kind: "cover", path: toRel(file), provider: "render", meta: { renderId, atSec: at } }));
  }
  return out;
}

export function registerRenderHandlers() {
  registerHandler("render", doRender);
}
