"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { api, useApi, ago } from "@/lib/client";
import { Badge, Button, Card, ErrorBox, Field, Notice, Progress, useConfirm, useToast, cx } from "@/components/ui";
import { useProject } from "@/components/ProjectContext";
import { VoicePanel } from "@/components/editor/VoicePanel";
import { ShortsPanel } from "@/components/editor/ShortsPanel";

interface Readiness {
  ok: boolean;
  problems: string[];
  warnings: string[];
  demo: boolean;
}
interface TLScene {
  id: string;
  idx: number;
  startSec: number;
  durationSec: number;
  plannedSec: number;
  extendedBy: number;
  lines: { text: string; speaker: string; atSec: number; durationSec: number }[];
  sfx: { name: string; atSec: number }[];
}
interface Plan {
  readiness: { preview: Readiness; final: Readiness };
  timeline: { scenes: TLScene[]; totalSec: number; transitionSec: number; warnings: string[] };
  cues: { start: number; end: number; text: string }[];
  clips: { sceneId: string; url: string | null; isDemo: boolean; provider: string | null; approval: string }[];
}
interface Render {
  id: string;
  quality: "preview" | "final";
  status: string;
  progress: number;
  url: string | null;
  srtUrl: string | null;
  vttUrl: string | null;
  isDemo: boolean;
  approval: "pending" | "approved" | "rejected";
  durationSec: number | null;
  error: string | null;
  log: string | null;
  warnings: string[];
  width?: number;
  height?: number;
  createdAt: number;
}
interface EditorOpts {
  music: "none" | "generated" | "upload";
  mood: string;
  musicAssetId: string | null;
  musicLicenseConfirmed: boolean;
  captions: "speech" | "captions" | "off";
  editStyle: "auto" | "punchy" | "cinematic";
  includeUnapproved: boolean;
}

const COLORS = ["bg-peach-500/70", "bg-berry-500/70", "bg-sky-400/70", "bg-lime-500/70", "bg-amber-400/70", "bg-fuchsia-400/70"];

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: proj } = useProject();
  const { data: plan, reload: reloadPlan } = useApi<Plan>(`/api/projects/${id}/render-plan`);
  const { data: rdata, reload: reloadRenders } = useApi<{ renders: Render[] }>(`/api/projects/${id}/renders`, (d) => (d?.renders.some((r) => r.status === "queued" || r.status === "running") ? 1500 : false));
  const { data: ed, reload: reloadEd } = useApi<{ options: EditorOpts; music: { id: string; url: string; meta: { originalName?: string; durationSec?: number } }[] }>(`/api/projects/${id}/editor`);
  const { data: exportsData, reload: reloadExports } = useApi<{ exports: { id: string; renderId: string; downloadUrl: string }[] }>(`/api/projects/${id}/exports`);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [license, setLicense] = useState(false);
  const musicRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const renders = rdata?.renders ?? [];
  const active = renders.find((r) => r.status === "queued" || r.status === "running");
  const latestFinal = renders.find((r) => r.quality === "final" && r.status === "done");
  const latestDone = renders.find((r) => r.status === "done");

  async function setOpt(patch: Partial<EditorOpts>) {
    try {
      await api(`/api/projects/${id}/editor`, { method: "PUT", body: patch });
      reloadEd();
      reloadPlan();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function uploadMusic(f: File) {
    if (!license) {
      toast("Tick the rights confirmation first.", "error");
      return;
    }
    setBusy("music");
    try {
      const form = new FormData();
      form.set("file", f);
      form.set("licenseConfirmed", "true");
      await api(`/api/projects/${id}/music`, { form });
      toast("Music imported");
      reloadEd();
      reloadPlan();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }
  async function startRender(quality: "preview" | "final") {
    setErr(null);
    setBusy(quality);
    try {
      await api(`/api/projects/${id}/renders`, { body: { quality } });
      reloadRenders();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function approve(r: Render, approval: "approved" | "rejected" | "pending") {
    if (approval === "approved") {
      const ok = await confirm({
        title: "Approve this edit?",
        body: r.isDemo ? "This render contains DEMO placeholder clips. It will stay labelled as a demo when exported." : "Approving marks this as the final cut you're happy with. You can then export the MP4.",
        confirmLabel: "Approve",
      });
      if (!ok) return;
    }
    await api(`/api/projects/${id}/renders/${r.id}`, { method: "PATCH", body: { approval } });
    reloadRenders();
  }
  async function doExport(r: Render) {
    setBusy(`export-${r.id}`);
    try {
      await api(`/api/projects/${id}/exports`, { body: { renderId: r.id } });
      toast("Exported to your Export Library");
      reloadExports();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }
  async function cancel(r: Render) {
    await api(`/api/projects/${id}/renders/${r.id}/cancel`, { body: {} });
    reloadRenders();
  }

  if (!proj || !plan || !ed) return <div className="shimmer h-64 rounded-2xl" />;
  const tl = plan.timeline;
  const total = tl.totalSec || 1;
  const opts = ed.options;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-white">Timeline · {tl.totalSec.toFixed(1)}s</div>
            <div className="text-xs text-ink-400">Scenes in story order, with voice lines, sound effects and captions. Reorder or retime scenes in the Script tab.</div>
          </div>
          <Link href={`/projects/${id}/story`}><Button size="sm" variant="ghost">Edit script / order →</Button></Link>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <div className="relative min-w-[640px] space-y-1.5">
            <div className="relative h-14">
              {tl.scenes.map((s, i) => {
                const clip = plan.clips.find((c) => c.sceneId === s.id);
                return (
                  <div key={s.id} className={cx("absolute top-0 h-14 overflow-hidden rounded-md border border-black/30 px-2 py-1 text-[11px] font-semibold text-ink-950", COLORS[i % COLORS.length], clip?.approval !== "approved" && "opacity-50")} style={{ left: `${(s.startSec / total) * 100}%`, width: `${(s.durationSec / total) * 100}%` }} title={`Scene ${s.idx + 1}: ${s.durationSec.toFixed(1)}s`}>
                    S{s.idx + 1} · {s.durationSec.toFixed(1)}s
                    <div className="font-normal">{clip?.url ? (clip.isDemo ? "demo" : clip.approval) : "no clip"}{s.extendedBy > 0.05 ? ` · +${s.extendedBy.toFixed(1)}s hold` : ""}</div>
                  </div>
                );
              })}
            </div>
            <div className="relative h-5 rounded bg-ink-950/60">
              {tl.scenes.flatMap((s) => s.lines).map((l, i) => (
                <div key={i} className="absolute top-0.5 h-4 rounded bg-white/70" style={{ left: `${(l.atSec / total) * 100}%`, width: `${(l.durationSec / total) * 100}%` }} title={`${l.speaker}: ${l.text}`} />
              ))}
              <span className="absolute -left-0 -top-0.5 text-[9px] text-ink-500">voice</span>
            </div>
            <div className="relative h-4 rounded bg-ink-950/60">
              {tl.scenes.flatMap((s) => s.sfx).map((x, i) => (
                <div key={i} className="absolute top-0 h-4 w-1 rounded bg-sky-400" style={{ left: `${(x.atSec / total) * 100}%` }} title={x.name} />
              ))}
            </div>
            <div className="relative h-4 rounded bg-ink-950/60">
              {plan.cues.map((c, i) => (
                <div key={i} className="absolute top-0.5 h-3 rounded bg-peach-400/70" style={{ left: `${(c.start / total) * 100}%`, width: `${((c.end - c.start) / total) * 100}%` }} title={c.text} />
              ))}
            </div>
          </div>
        </div>
        {tl.warnings.length > 0 && <div className="mt-2 space-y-0.5 text-xs text-amber-300">{tl.warnings.map((w) => <div key={w}>• {w}</div>)}</div>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <VoicePanel projectId={id} onChanged={reloadPlan} />
        <Card className="space-y-4 p-5">
          <div className="font-display text-lg font-semibold text-white">Edit style, music & captions</div>
          <Field label="Edit style" hint="Punchy = how viral Shorts are cut: hard cuts, slow push-in on every shot, a whoosh on each cut, word-by-word highlighted captions, big hook title in the first seconds.">
            <select value={opts.editStyle} onChange={(e) => setOpt({ editStyle: e.target.value as EditorOpts["editStyle"] })}>
              <option value="auto">Auto (punchy for drama/funny/twist, cinematic otherwise)</option>
              <option value="punchy">Punchy Shorts edit</option>
              <option value="cinematic">Cinematic (soft transitions)</option>
            </select>
          </Field>
          <Field label="Background music">
            <select value={opts.music} onChange={(e) => setOpt({ music: e.target.value as EditorOpts["music"] })}>
              <option value="generated">Generated original bed (free, royalty-free)</option>
              <option value="upload">My own licensed track</option>
              <option value="none">No music</option>
            </select>
          </Field>
          {opts.music === "generated" && (
            <Field label="Mood">
              <select value={opts.mood} onChange={(e) => setOpt({ mood: e.target.value })}>
                <option value="auto">Auto (from genre)</option>
                <option value="major">Warm / wholesome</option>
                <option value="playful">Playful</option>
                <option value="minor">Emotional</option>
                <option value="mystery">Mysterious</option>
              </select>
            </Field>
          )}
          {opts.music === "upload" && (
            <div className="space-y-2 rounded-lg border border-ink-700 p-3">
              {ed.music.length > 0 && (
                <select value={opts.musicAssetId ?? ""} onChange={(e) => setOpt({ musicAssetId: e.target.value || null, musicLicenseConfirmed: true })}>
                  <option value="">Choose an imported track…</option>
                  {ed.music.map((m) => (
                    <option key={m.id} value={m.id}>{m.meta.originalName ?? m.id} ({m.meta.durationSec?.toFixed(0)}s)</option>
                  ))}
                </select>
              )}
              <label className="flex items-start gap-2 text-xs normal-case tracking-normal text-ink-300">
                <input type="checkbox" checked={license} onChange={(e) => setLicense(e.target.checked)} className="mt-0.5" />
                I own this music or have a license that allows using it in YouTube videos. (Copyrighted music without permission can get a Short muted or blocked.)
              </label>
              <Button size="sm" onClick={() => musicRef.current?.click()} disabled={!license} loading={busy === "music"}>⇪ Import track</Button>
              <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && uploadMusic(e.target.files[0])} />
            </div>
          )}
          <Field label="Captions">
            <select value={opts.captions} onChange={(e) => setOpt({ captions: e.target.value as EditorOpts["captions"] })}>
              <option value="speech">Spoken lines (falls back to scene captions)</option>
              <option value="captions">Scene captions only</option>
              <option value="off">No burned-in captions</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-ink-300">
            <input type="checkbox" checked={opts.includeUnapproved} onChange={(e) => setOpt({ includeUnapproved: e.target.checked })} /> Allow unapproved clips in previews
          </label>
          <p className="text-xs text-ink-500">Transitions, volumes and caption size: <Link className="underline" href="/settings">Settings → Render defaults</Link>.</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold text-white">Render, review, approve, export</div>
            <div className="text-xs text-ink-400">Preview renders fast at 540×960. The final render is 1080×1920 H.264/AAC. Only an approved final render can be exported.</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => startRender("preview")} loading={busy === "preview"} disabled={!!active || !plan.readiness.preview.ok}>Render preview</Button>
            <Button variant="primary" onClick={() => startRender("final")} loading={busy === "final"} disabled={!!active || !plan.readiness.final.ok}>Render final 1080p</Button>
          </div>
        </div>
        {!plan.readiness.final.ok && (
          <Notice tone="warn" className="mb-3">
            <div className="font-semibold">Before the final render:</div>
            {plan.readiness.final.problems.map((p) => <div key={p}>• {p}</div>)}
            <Link className="underline" href={`/projects/${id}/scenes`}>Go to AI Clips →</Link>
          </Notice>
        )}
        {[...plan.readiness.final.warnings].map((w) => <div key={w} className="mb-1 text-xs text-amber-300">• {w}</div>)}
        <ErrorBox error={err} className="mb-3" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {renders.slice(0, 6).map((r) => {
            const exported = exportsData?.exports.find((e) => e.renderId === r.id);
            return (
              <div key={r.id} className={cx("overflow-hidden rounded-xl border bg-ink-950/40", r.approval === "approved" ? "border-lime-500/50" : "border-ink-700")}>
                <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Badge tone={r.status}>{r.status}</Badge>
                    <span className="font-semibold text-ink-200">{r.quality === "final" ? "Final 1080p" : "Preview"}</span>
                    {r.isDemo && <Badge tone="demo">demo</Badge>}
                  </span>
                  <span className="text-ink-500">{ago(r.createdAt)}</span>
                </div>
                {r.status === "done" && r.url ? (
                  <video src={r.url} controls playsInline className="aspect-[9/16] max-h-[520px] w-full bg-black object-contain" />
                ) : r.status === "queued" || r.status === "running" ? (
                  <div className="space-y-2 p-4">
                    <div className="truncate text-xs text-ink-400">{r.log?.split("\n").pop() ?? "Queued…"}</div>
                    <Progress value={r.progress} />
                    <Button size="sm" variant="danger" onClick={() => cancel(r)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="p-4 text-xs text-berry-400">{r.error}</div>
                )}
                {r.status === "done" && (
                  <div className="flex flex-wrap items-center gap-1.5 p-3">
                    <span className="mr-auto text-xs text-ink-500">{r.width}×{r.height} · {r.durationSec?.toFixed(1)}s</span>
                    {r.approval !== "approved" ? (
                      <>
                        <Button size="sm" variant="success" onClick={() => approve(r, "approved")}>✓ Approve</Button>
                        <Button size="sm" onClick={() => approve(r, "rejected")}>Reject</Button>
                      </>
                    ) : (
                      <>
                        <Badge tone="approved">approved</Badge>
                        {r.quality === "final" &&
                          (exported ? (
                            <a href={exported.downloadUrl}><Button size="sm" variant="primary">⬇ Download MP4</Button></a>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => doExport(r)} loading={busy === `export-${r.id}`}>Export MP4</Button>
                          ))}
                      </>
                    )}
                  </div>
                )}
                {r.log && (
                  <details className="border-t border-ink-800 px-3 py-2 text-[11px] text-ink-500">
                    <summary className="cursor-pointer">Render log</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{r.log}</pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
        {renders.length === 0 && <div className="py-6 text-center text-sm text-ink-500">No renders yet. Start with a quick preview.</div>}
      </Card>

      <ShortsPanel projectId={id} finalRenderId={latestFinal?.id ?? null} srtUrl={latestDone?.srtUrl ?? null} vttUrl={latestDone?.vttUrl ?? null} />
    </div>
  );
}
