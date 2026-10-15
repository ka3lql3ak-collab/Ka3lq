"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { api, useApi } from "@/lib/client";
import { callPaid } from "@/lib/paid";
import { rid } from "@/lib/rid";
import { Badge, Button, Card, Empty, ErrorBox, Modal, Notice, Spinner, useConfirm, useToast } from "@/components/ui";
import { useProject, type CharacterView } from "@/components/ProjectContext";
import { CharacterEditor } from "@/components/CharacterEditor";

interface Asset {
  id: string;
  url: string;
  provider: string;
  isDemo: boolean;
  createdAt: number;
}
interface Gen {
  id: string;
  status: string;
  error: string | null;
  provider: string;
  estimatedCost: number;
}
interface SceneView {
  id: string;
  idx: number;
  beat: string;
  durationSec: number;
  caption: string;
  visual: string;
  characters: string[];
  storyboard: Asset | null;
  imageGen: Gen | null;
}

const ACTIVE = ["queued", "submitting", "submitted", "generating"];

export default function StoryboardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: proj, reload: reloadProject } = useProject();
  const { data, reload } = useApi<{ scenes: SceneView[] }>(`/api/projects/${id}/scenes`, (d) => (d?.scenes.some((s) => s.imageGen && ACTIVE.includes(s.imageGen.status)) ? 1500 : false));
  const { data: status } = useApi<{ capabilities: { luma: boolean; demoMode: boolean } }>("/api/status");
  const { data: lib } = useApi<{ characters: CharacterView[] }>("/api/characters");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<SceneView | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const scenes = data?.scenes ?? [];
  const cast = proj?.characters ?? [];
  const lumaReady = !!status?.capabilities.luma;
  const missingRefs = cast.filter((c) => !c.approvedImageId);

  async function sketchAll(all = false) {
    setBusy("all");
    setError(null);
    try {
      await api(`/api/projects/${id}/storyboards`, { body: { all } });
      toast("Sketching storyboards…", "info");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function gen(sc: SceneView, providerId: "sketch" | "luma-image") {
    setBusy(`${sc.id}:${providerId}`);
    setError(null);
    try {
      if (providerId === "luma-image" && missingRefs.length) {
        const ok = await confirm({
          title: "Some characters have no approved reference",
          body: `${missingRefs.map((c) => c.name).join(", ")} will be drawn from text only, so their look may differ between scenes. Approve a reference image in the cast panel first for better consistency.`,
          confirmLabel: "Continue anyway",
        });
        if (!ok) return;
      }
      await callPaid(`/api/projects/${id}/scenes/${sc.id}/storyboard`, { providerId, requestId: rid() }, confirm, `An AI storyboard frame for scene ${sc.idx + 1}`);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function link(characterId: string) {
    if (!characterId) return;
    await api(`/api/projects/${id}/characters`, { body: { characterId, action: "link" } });
    reloadProject();
  }
  async function unlink(c: CharacterView) {
    if (!(await confirm({ title: `Remove ${c.name} from this project?`, body: "The character stays in your library.", confirmLabel: "Remove" }))) return;
    await api(`/api/projects/${id}/characters`, { body: { characterId: c.id, action: "unlink" } });
    reloadProject();
  }

  if (!proj) return <div className="shimmer h-64 rounded-2xl" />;
  if (!proj.project.story) return <Empty title="Write the script first" action={<Link href={`/projects/${id}/story`}><Button variant="primary">Go to script</Button></Link>} />;

  return (
    <div className="space-y-6">
      {!proj.project.scriptApproved && (
        <Notice tone="warn">
          The script isn&apos;t approved yet. Storyboards are free, so explore away, but <Link className="underline" href={`/projects/${id}/story`}>approve the script</Link> before paying for AI clips.
        </Notice>
      )}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold text-white">Cast · Character Bible</div>
            <div className="text-sm text-ink-400">Approve a reference image per character before generating AI frames. The same reference is reused in every scene.</div>
          </div>
          <select className="w-auto" value="" onChange={(e) => link(e.target.value)} aria-label="Add character from library">
            <option value="">+ Add from library…</option>
            {lib?.characters.filter((c) => !cast.some((x) => x.id === c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.fruit})</option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cast.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-950/40 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                {c.approvedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.approvedImageUrl} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center">
                    <span className="h-8 w-8 rounded-full" style={{ background: c.palette[0] }} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{c.name}</div>
                <div className="text-xs capitalize text-ink-400">{c.fruit}</div>
                <div className="mt-1 flex gap-1">
                  {c.approvedImageId ? <Badge tone="approved">ref ✓</Badge> : <Badge tone="awaiting_approval">no ref</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={() => setEditing(c.id)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => unlink(c)} aria-label={`Remove ${c.name}`}>✕</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold text-white">Storyboard</div>
          <div className="text-sm text-ink-400">Check the story visually before paying to animate. Sketches are free; AI frames (Luma Photon) can be used as image-to-video keyframes.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sketchAll(false)} loading={busy === "all"} disabled={scenes.every((s) => s.storyboard)}>Sketch missing (free)</Button>
          <Button variant="ghost" onClick={() => sketchAll(true)} disabled={busy === "all"}>Re-sketch all</Button>
          <Link href={`/projects/${id}/scenes`}><Button variant="primary">Continue to AI clips →</Button></Link>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {scenes.map((sc) => (
          <StoryboardCard key={sc.id} sc={sc} projectId={id} lumaReady={lumaReady} busy={busy} onGen={(p) => gen(sc, p)} onOpen={() => setPreview(sc)} onChanged={reload} />
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Character Bible" wide>
        {editing && <CharacterEditor id={editing} lumaReady={lumaReady} onSaved={reloadProject} />}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `Scene ${preview.idx + 1} · ${preview.beat}` : ""} wide>
        {preview && (
          <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
            {preview.storyboard ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.storyboard.url} alt="" className="w-full rounded-xl" />
            ) : (
              <div className="aspect-[9/16] rounded-xl bg-ink-800" />
            )}
            <div className="space-y-3 text-sm">
              <p className="text-ink-200">{preview.visual}</p>
              <p className="text-ink-400">Characters: {preview.characters.join(", ")}</p>
              <p className="text-ink-400">Caption: “{preview.caption}”</p>
              <Link href={`/projects/${id}/story`} className="text-peach-400 underline">Edit in script →</Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StoryboardCard({ sc, projectId, lumaReady, busy, onGen, onOpen, onChanged }: { sc: SceneView; projectId: string; lumaReady: boolean; busy: string | null; onGen: (p: "sketch" | "luma-image") => void; onOpen: () => void; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const active = sc.imageGen && ACTIVE.includes(sc.imageGen.status);
  async function upload(f: File) {
    const form = new FormData();
    form.set("file", f);
    form.set("kind", "storyboard");
    try {
      await api(`/api/projects/${projectId}/scenes/${sc.id}/upload`, { form });
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <Card className="overflow-hidden">
      <button onClick={onOpen} className="relative block aspect-[9/16] w-full bg-ink-850">
        {sc.storyboard ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sc.storyboard.url} alt={`Scene ${sc.idx + 1}`} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center p-3 text-center text-xs text-ink-500">{sc.visual.slice(0, 120)}…</div>
        )}
        {active && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-white">
            <span className="flex items-center gap-2"><Spinner /> {sc.imageGen!.status}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">{sc.idx + 1}</span>
          {sc.storyboard && sc.storyboard.provider !== "sketch" && <Badge tone={sc.storyboard.provider === "upload" ? "pending" : "paid"}>{sc.storyboard.provider === "upload" ? "upload" : "AI frame"}</Badge>}
        </div>
      </button>
      <div className="space-y-2 p-2.5">
        <div className="line-clamp-1 text-xs text-ink-300">{sc.caption || sc.beat} · {sc.durationSec}s</div>
        {sc.imageGen?.status === "failed" && <div className="line-clamp-3 text-[11px] text-berry-400" title={sc.imageGen.error ?? ""}>⚠ {sc.imageGen.error}</div>}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" onClick={() => onGen("sketch")} loading={busy === `${sc.id}:sketch`} disabled={!!active}>Sketch</Button>
          <Button size="sm" variant="primary" onClick={() => onGen("luma-image")} loading={busy === `${sc.id}:luma-image`} disabled={!lumaReady || !!active} title={lumaReady ? "Paid — you'll confirm the cost first" : "Requires LUMA_API_KEY"}>
            AI $
          </Button>
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} title="Upload your own keyframe image">⇪</Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
      </div>
    </Card>
  );
}
