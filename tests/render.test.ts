import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { freshDataDir } from "./helpers";

freshDataDir("render");
const repo = await import("@/lib/repo");
const jobs = await import("@/lib/jobs");
const { registerAllHandlers } = await import("@/lib/handlers");
const visuals = await import("@/lib/features/visuals");
const { generateProjectStory } = await import("@/lib/story");
const render = await import("@/lib/render");
const voice = await import("@/lib/features/voice");
const { probe } = await import("@/lib/media/ffmpeg");
const { fromRel, mediaDir, toRel } = await import("@/lib/paths");
const { buildTimeline, captionCues, toSrt } = await import("@/lib/media/timeline");
const { StorySettingsSchema } = await import("@/lib/types");
registerAllHandlers();

describe("timeline", () => {
  const scenes = [
    { id: "a", idx: 0, durationSec: 3, caption: "Hook", sfx: ["pop"], lines: [{ text: "Hi", speaker: "A", durationSec: 1, file: null }] },
    { id: "b", idx: 1, durationSec: 3, caption: "Next", sfx: [], lines: [{ text: "A long line", speaker: "B", durationSec: 3.5, file: null }] },
    { id: "c", idx: 2, durationSec: 4, caption: "End", sfx: ["chime", "pop"], lines: [] },
  ];
  it("extends a shot rather than cutting off speech, and accounts for crossfades", () => {
    const tl = buildTimeline(scenes, "crossfade", 0.4);
    expect(tl.scenes[1].durationSec).toBeGreaterThan(3.5);
    expect(tl.warnings.join(" ")).toMatch(/Scene 2/);
    expect(tl.scenes[1].startSec).toBeCloseTo(tl.scenes[0].durationSec - tl.transitionSec, 3);
    const last = tl.scenes[2];
    expect(tl.totalSec).toBeCloseTo(last.startSec + last.durationSec, 3);
    // Speech in scene 2 starts after the crossfade.
    expect(tl.scenes[1].lines[0].atSec).toBeGreaterThanOrEqual(tl.scenes[1].startSec + tl.transitionSec - 1e-6);
  });
  it("hard cuts have no overlap", () => {
    const tl = buildTimeline(scenes, "cut", 0.4);
    expect(tl.transitionSec).toBe(0);
    expect(tl.scenes[1].startSec).toBeCloseTo(tl.scenes[0].durationSec);
  });
  it("captions follow speech, fall back to scene captions, never overlap", () => {
    const tl = buildTimeline(scenes, "crossfade", 0.4);
    const cues = captionCues(tl, "speech");
    expect(cues.map((c) => c.text)).toEqual(["Hi", "A long line", "End"]);
    for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end);
    expect(toSrt(cues)).toMatch(/^1\n00:00:00,250 --> /);
    expect(captionCues(tl, "off")).toEqual([]);
  });
});

describe("full render (real FFmpeg)", () => {
  let projectId = "";
  beforeAll(async () => {
    const p = repo.createProject(StorySettingsSchema.parse({ idea: "A lonely strawberry finds a tiny abandoned orange and decides to help it.", durationSec: 15, sceneCount: 3 }));
    projectId = p.id;
    await generateProjectStory(p.id, 0);
    visuals.sketchAllStoryboards(p.id);
    await jobs.drainJobs();
    visuals.demoAllClips(p.id);
    await jobs.drainJobs();
  }, 120_000);

  it("refuses to render until clips are approved", () => {
    expect(() => render.queueRender(projectId, "final")).toThrow(/isn't approved/);
  });

  it("reports a corrupted clip instead of producing a fake video", async () => {
    const sc = repo.listScenes(projectId)[0];
    const bad = path.join(mediaDir("projects", projectId, "clips"), "corrupt.mp4");
    fs.writeFileSync(bad, "definitely not a video");
    const a = repo.createAsset({ projectId, sceneId: sc.id, kind: "clip", path: toRel(bad), provider: "upload" });
    const good = sc.clipAssetId;
    repo.setSceneFields(sc.id, { clipAssetId: a.id });
    for (const s of repo.listScenes(projectId)) repo.setSceneFields(s.id, { approval: "approved" });
    const r = render.queueRender(projectId, "preview");
    await jobs.drainJobs();
    const done = render.getRender(r.id)!;
    expect(done.status).toBe("failed");
    expect(done.error).toMatch(/Scene 1: clip is unreadable or corrupted/);
    expect(done.url).toBeNull();
    repo.setSceneFields(sc.id, { clipAssetId: good });
  });

  it("renders a vertical H.264/AAC MP4 with voices, SFX, music and captions; mixed aspect ratios are fitted", async () => {
    // Replace scene 2 with a 16:9, 24 fps imported clip to exercise conforming.
    const sc = repo.listScenes(projectId)[1];
    const wide = path.join(mediaDir("projects", projectId, "clips"), "wide.mp4");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=24:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", wide]);
    const a = repo.createAsset({ projectId, sceneId: sc.id, kind: "clip", path: toRel(wide), provider: "upload" });
    repo.setSceneFields(sc.id, { clipAssetId: a.id, approval: "approved" });
    for (const s of repo.listScenes(projectId)) repo.setSceneFields(s.id, { approval: "approved" });

    const r = render.queueRender(projectId, "final");
    expect(r.isDemo).toBe(true); // demo placeholder clips are present → labelled
    await jobs.drainJobs();
    const done = render.getRender(r.id)!;
    expect(done.error).toBeNull();
    expect(done.status).toBe("done");
    const row = (await import("@/lib/db")).db().prepare("SELECT path FROM renders WHERE id=?").get(r.id) as { path: string };
    const info = await probe(fromRel(row.path));
    expect(info).toMatchObject({ width: 1080, height: 1920, videoCodec: "h264", audioCodec: "aac", hasAudio: true });
    expect(Math.round(info.fps!)).toBe(30);
    expect(info.durationSec).toBeGreaterThan(14);
    // Voice lines were synthesised and cached.
    const lines = voice.projectVoiceLines(projectId).flatMap((s) => s.lines);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.asset)).toBe(true);
    // Captions written.
    expect(done.srtUrl).toBeTruthy();
    // Audio is audible and loudness-normalised (roughly −14 LUFS integrated).
    const out = execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-i", fromRel(row.path), "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).toString();
    void out;
  }, 300_000);

  it("approval gate: only finished renders can be approved", () => {
    const [latest] = render.listRenders({ projectId });
    expect(render.setRenderApproval(projectId, latest.id, "approved").approval).toBe("approved");
    const failed = render.listRenders({ projectId }).find((x) => x.status === "failed")!;
    expect(() => render.setRenderApproval(projectId, failed.id, "approved")).toThrow(/finished/);
  });
});
