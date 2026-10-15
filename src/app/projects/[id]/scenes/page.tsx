"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, money, useApi } from "@/lib/client";
import { callPaid } from "@/lib/paid";
import { rid } from "@/lib/rid";
import { Badge, Button, Card, Empty, ErrorBox, Modal, Notice, Spinner, useConfirm, useToast, cx } from "@/components/ui";
import { useProject } from "@/components/ProjectContext";
import { providerLabel } from "@/lib/labels";

interface Asset {
  id: string;
  url: string;
  provider: string;
  isDemo: boolean;
  approval: string;
  createdAt: number;
  meta: Record<string, unknown>;
}
interface Gen {
  id: string;
  status: string;
  error: string | null;
  provider: string;
  model: string;
  estimatedCost: number;
  actualCost: number | null;
  isPaid: boolean;
  createdAt: number;
}
interface SceneView {
  id: string;
  idx: number;
  beat: string;
  durationSec: number;
  caption: string;
  visual: string;
  approval: "pending" | "approved" | "rejected";
  storyboard: Asset | null;
  clip: Asset | null;
  videoGen: Gen | null;
  imageGen: Gen | null;
  spent: number;
}
interface Plan {
  providerId: string;
  model: string;
  mode: "image-to-video" | "text-to-video" | "demo" | "blocked";
  keyframeSource: string | null;
  estimate: number;
  note: string | null;
  preferred: string;
  preferredConfigured: boolean;
  duration: string | null;
}
interface Status {
  capabilities: { demoMode: boolean };
  providers: { keyframe: { id: string; label: string } | null; video: { preferred: string; label: string; configured: { ok: boolean; reason?: string } } };
}

const ACTIVE = ["queued", "submitting", "submitted", "generating"];

export default function ScenesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: proj, reload: reloadProject } = useProject();
  const { data, reload } = useApi<{ scenes: SceneView[] }>(`/api/projects/${id}/scenes`, (d) =>
    d?.scenes.some((s) => (s.videoGen && ACTIVE.includes(s.videoGen.status)) || (s.imageGen && ACTIVE.includes(s.imageGen.status))) ? 2500 : false,
  );
  const { data: status } = useApi<Status>("/api/status");
  const [error, setError] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const toast = useToast();
  const scenes = data?.scenes ?? [];
  const approved = scenes.filter((s) => s.approval === "approved").length;
  const vp = status?.providers.video;

  async function demoAll() {
    setBusyAll(true);
    try {
      await api(`/api/projects/${id}/clips`, { body: {} });
      toast("Rendering free demo placeholders…", "info");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAll(false);
    }
  }

  if (!proj) return <div className="shimmer h-64 rounded-2xl" />;
  if (!scenes.length) return <Empty title="No scenes yet" action={<Link href={`/projects/${id}/story`}><Button variant="primary">Write the script</Button></Link>} />;

  return (
    <div className="space-y-5">
      {vp &&
        (vp.configured.ok ? (
          <Notice tone="ok">
            Video provider: <b>{vp.label}</b> — configured. Every paid clip shows its estimated cost and needs your confirmation. Failed jobs are never retried automatically.
          </Notice>
        ) : vp.preferred === "higgsfield" ? (
          <Notice tone="warn">
            <b>Higgsfield is your video provider, but its API isn&apos;t configured.</b> {vp.configured.reason} Until then you can (1) generate clips in the Higgsfield app and <b>import</b> them per scene, or (2) make free, watermarked demo placeholders to test the edit. The app never switches to another paid provider on its own.{" "}
            <Link className="underline" href="/settings">Setup steps →</Link>
          </Notice>
        ) : (
          <Notice tone="warn">
            {vp.label}: {vp.configured.reason} <Link className="underline" href="/settings">Settings →</Link>
          </Notice>
        ))}
      {!proj.project.scriptApproved && (
        <Notice tone="warn">
          Approve the script before generating paid clips, so you don&apos;t pay to animate a story you&apos;ll change. <Link className="underline" href={`/projects/${id}/story`}>Review script →</Link>
        </Notice>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-400">
          {approved}/{scenes.length} scenes approved · spent {money(scenes.reduce((a, s) => a + s.spent, 0))}
        </div>
        <div className="flex flex-wrap gap-2">
          {status?.capabilities.demoMode && (
            <Button onClick={demoAll} loading={busyAll} disabled={scenes.every((s) => s.clip)}>
              Demo placeholders for missing clips (free)
            </Button>
          )}
          <Link href={`/projects/${id}/editor`}>
            <Button variant="primary" disabled={approved === 0}>Edit approved clips →</Button>
          </Link>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="space-y-4">
        {scenes.map((sc) => (
          <SceneRow key={sc.id} projectId={id} sc={sc} keyframe={status?.providers.keyframe ?? null} onChanged={() => { reload(); reloadProject(); }} />
        ))}
      </div>
    </div>
  );
}

function SceneRow({ projectId, sc, keyframe, onChanged }: { projectId: string; sc: SceneView; keyframe: { id: string; label: string } | null; onChanged: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [takesOpen, setTakesOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const active = sc.videoGen && ACTIVE.includes(sc.videoGen.status);
  const imgActive = sc.imageGen && ACTIVE.includes(sc.imageGen.status);
  const boardKey = `${sc.storyboard?.id}-${sc.clip?.id}-${sc.videoGen?.status}`;

  useEffect(() => {
    api<{ plan: Plan; prompt: string }>(`/api/projects/${projectId}/scenes/${sc.id}/clip`)
      .then((r) => {
        setPlan(r.plan);
        setPrompt(r.prompt);
      })
      .catch((e) => setErr((e as Error).message));
  }, [projectId, sc.id, boardKey]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const generate = () =>
    run("clip", async () => {
      if (sc.clip && sc.approval === "approved" && !(await confirm({ title: "Replace an approved clip?", body: "The current clip stays in Takes; the new one will need approval.", confirmLabel: "Generate new take" }))) return;
      await callPaid(`/api/projects/${projectId}/scenes/${sc.id}/clip`, { requestId: rid() }, confirm, `Animating scene ${sc.idx + 1}`);
    });
  const makeKeyframe = () =>
    run("kf", async () => {
      if (!keyframe) return;
      await callPaid(`/api/projects/${projectId}/scenes/${sc.id}/storyboard`, { providerId: keyframe.id, requestId: rid() }, confirm, `An AI keyframe for scene ${sc.idx + 1}`);
    });
  const setApproval = (approval: "approved" | "rejected" | "pending") => run(approval, () => api(`/api/projects/${projectId}/scenes/${sc.id}`, { method: "PATCH", body: { approval } }));
  const cancel = () =>
    run("cancel", async () => {
      const r = await api<{ generation: Gen }>(`/api/generations/${sc.videoGen!.id}/cancel`, { body: {} });
      toast(r.generation.error ?? "Cancelled", "info");
    });
  const upload = (f: File, source: string) =>
    run("upload", async () => {
      const form = new FormData();
      form.set("file", f);
      form.set("kind", "clip");
      form.set("source", source);
      await api(`/api/projects/${projectId}/scenes/${sc.id}/upload`, { form });
      toast("Clip imported — review and approve it");
    });

  const g = sc.videoGen;
  return (
    <Card className={cx("p-4", sc.approval === "approved" && "border-lime-500/40", sc.approval === "rejected" && "border-berry-500/30")}>
      <div className="grid gap-4 md:grid-cols-[110px_200px_1fr]">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Keyframe</div>
          <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-ink-850">
            {sc.storyboard ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sc.storyboard.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[10px] text-ink-600">none</div>
            )}
            {imgActive && (
              <div className="absolute inset-0 grid place-items-center bg-black/60"><Spinner /></div>
            )}
            {sc.storyboard && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">{sc.storyboard.provider === "sketch" ? "SKETCH" : sc.storyboard.provider === "upload" ? "UPLOAD" : "AI"}</span>}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Clip</div>
          <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black">
            {sc.clip ? (
              <video key={sc.clip.id} src={sc.clip.url} controls playsInline loop className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full place-items-center p-3 text-center text-xs text-ink-600">{active ? "" : "No clip yet"}</div>
            )}
            {active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-xs text-white">
                <Spinner className="h-6 w-6" />
                <Badge tone={g!.status}>{g!.status}</Badge>
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold text-white">Scene {sc.idx + 1}</span>
            <Badge tone="pending">{sc.beat}</Badge>
            <span className="text-xs text-ink-500">{sc.durationSec}s</span>
            <Badge tone={sc.approval}>{sc.approval}</Badge>
            {sc.clip && <Badge tone={sc.clip.isDemo ? "demo" : sc.clip.provider.startsWith("higgsfield") ? "approved" : "pending"}>{providerLabel(sc.clip.provider)}</Badge>}
            {sc.spent > 0 && <span className="text-xs text-ink-500">spent {money(sc.spent)}</span>}
          </div>
          <p className="line-clamp-2 text-sm text-ink-300">{sc.visual}</p>
          {plan && (
            <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-3 text-xs text-ink-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Method: <b className="text-ink-200">{plan.mode === "demo" ? "demo placeholder (free, not AI)" : plan.mode === "blocked" ? "needs AI keyframe" : `${plan.mode} · ${plan.model}`}</b>
                </span>
                {plan.keyframeSource && plan.mode !== "demo" && <span>Start frame: <b className="text-ink-200">{plan.keyframeSource}</b></span>}
                {plan.mode !== "demo" && <span>Estimate: <b className="text-white">{money(plan.estimate)}</b></span>}
              </div>
              {plan.note && <div className="mt-1 text-ink-500">{plan.note}</div>}
            </div>
          )}
          {g?.status === "failed" && <ErrorBox error={`Last attempt failed: ${g.error}`} />}
          {g?.status === "unknown" && <Notice tone="warn">{g.error}</Notice>}
          {g?.status === "cancelled" && g.error && <div className="text-xs text-ink-500">{g.error}</div>}
          <ErrorBox error={err} />
          <div className="flex flex-wrap gap-2">
            {plan?.mode === "blocked" ? (
              <Button variant="primary" onClick={makeKeyframe} loading={busy === "kf"} disabled={!keyframe || !!imgActive}>
                {keyframe ? `Make AI keyframe · ${keyframe.label.replace(" (paid)", "")}` : "AI keyframe unavailable"}
              </Button>
            ) : (
              <Button variant="primary" onClick={generate} loading={busy === "clip"} disabled={!plan || !!active}>
                {plan?.mode === "demo" ? (sc.clip ? "New demo placeholder (free)" : "Demo placeholder (free)") : sc.clip ? `Regenerate · ~${money(plan?.estimate)}` : `Generate clip · ~${money(plan?.estimate)}`}
              </Button>
            )}
            {active && g && (
              <Button variant="danger" onClick={cancel} loading={busy === "cancel"}>Cancel</Button>
            )}
            {g?.status === "unknown" && (
              <Button onClick={cancel} loading={busy === "cancel"}>Dismiss (I checked the dashboard)</Button>
            )}
            {sc.clip && sc.approval !== "approved" && (
              <Button variant="success" onClick={() => setApproval("approved")} loading={busy === "approved"}>✓ Approve</Button>
            )}
            {sc.clip && sc.approval !== "rejected" && (
              <Button onClick={() => setApproval("rejected")} loading={busy === "rejected"}>Reject</Button>
            )}
            {sc.approval === "approved" && <Button variant="ghost" onClick={() => setApproval("pending")}>Unapprove</Button>}
            <Button variant="ghost" onClick={() => setTakesOpen(true)}>Takes</Button>
            <Button variant="ghost" onClick={() => setManualOpen((x) => !x)}>Generate in Higgsfield app ▾</Button>
          </div>
          {manualOpen && (
            <div className="space-y-2 rounded-xl border border-sky-400/25 bg-sky-400/5 p-3 text-sm text-ink-300">
              <div className="font-semibold text-sky-300">Manual workflow · Higgsfield web app (uses your app credits, no API key needed)</div>
              <ol className="list-decimal space-y-1 pl-5 text-xs">
                <li>
                  {sc.storyboard && sc.storyboard.provider !== "sketch" ? (
                    <a className="text-peach-400 underline" href={`${sc.storyboard.url}?download=1`}>Download this scene&apos;s keyframe</a>
                  ) : (
                    <>Use your approved character reference image as the start image (download it from the Character Bible)</>
                  )}
                  , then upload it in Higgsfield as the start image.
                </li>
                <li>
                  Paste this prompt{" "}
                  <button
                    className="text-peach-400 underline"
                    onClick={() => {
                      navigator.clipboard.writeText(prompt).then(() => toast("Prompt copied"), () => toast("Copy failed — select the text below", "error"));
                    }}
                  >
                    (copy)
                  </button>
                  <textarea readOnly rows={3} value={prompt} className="mt-1 text-xs" />
                </li>
                <li>Pick an image-to-video model, aspect ratio <b>9:16</b>, duration ≥ <b>{Math.ceil(sc.durationSec)}s</b>, and turn its sound off (this app adds voice, SFX and music).</li>
                <li>Download the MP4 and import it here:</li>
              </ol>
              <Button size="sm" onClick={() => fileRef.current?.click()} loading={busy === "upload"}>⇪ Import clip from Higgsfield app</Button>
              <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "higgsfield-app")} />
            </div>
          )}
        </div>
      </div>
      <TakesModal open={takesOpen} onClose={() => setTakesOpen(false)} projectId={projectId} sceneId={sc.id} currentClip={sc.clip?.id ?? null} onChanged={onChanged} />
    </Card>
  );
}

function TakesModal({ open, onClose, projectId, sceneId, currentClip, onChanged }: { open: boolean; onClose: () => void; projectId: string; sceneId: string; currentClip: string | null; onChanged: () => void }) {
  const { data, reload } = useApi<{ clips: Asset[]; generations: Gen[] }>(open ? `/api/projects/${projectId}/scenes/${sceneId}/takes` : null);
  async function select(assetId: string) {
    await api(`/api/projects/${projectId}/scenes/${sceneId}/takes`, { body: { assetId } });
    reload();
    onChanged();
  }
  return (
    <Modal open={open} onClose={onClose} title="Takes & generation history" wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data?.clips.map((c) => (
          <div key={c.id} className={cx("overflow-hidden rounded-lg border", c.id === currentClip ? "border-peach-500" : "border-ink-700")}>
            <video src={c.url} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
            <div className="space-y-1 p-2 text-[11px]">
              <Badge tone={c.isDemo ? "demo" : "pending"}>{providerLabel(c.provider)}</Badge>
              {c.id === currentClip ? <div className="text-peach-400">In use</div> : <Button size="sm" onClick={() => select(c.id)}>Use this take</Button>}
            </div>
          </div>
        ))}
      </div>
      {data && data.clips.length === 0 && <div className="text-sm text-ink-500">No takes yet.</div>}
      <div className="mt-5 space-y-1 text-xs">
        <div className="font-semibold text-ink-300">History</div>
        {data?.generations.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-2 border-b border-ink-800 py-1.5">
            <Badge tone={g.status}>{g.status}</Badge>
            <span className="text-ink-400">{g.provider} · {g.model}</span>
            {g.isPaid && <span className="text-ink-500">est. {money(g.estimatedCost)}{g.actualCost !== null ? ` · actual ${money(g.actualCost)}` : ""}</span>}
            <span className="ml-auto text-ink-600">{new Date(g.createdAt).toLocaleString()}</span>
            {g.error && <div className="w-full text-ink-500">{g.error}</div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
