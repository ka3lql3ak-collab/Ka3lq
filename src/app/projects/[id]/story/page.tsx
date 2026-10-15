"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, useApi } from "@/lib/client";
import { callPaid } from "@/lib/paid";
import { useJob } from "@/lib/useJob";
import { Button, Card, Empty, ErrorBox, Field, Notice, Progress, useConfirm, useToast } from "@/components/ui";
import { useProject } from "@/components/ProjectContext";
import { SceneScriptEditor, type SceneData } from "@/components/SceneScriptEditor";
import { StorySettingsForm, type StorySettingsValue } from "@/components/StorySettingsForm";

function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { data, reload } = useProject();
  const { data: scenesData, reload: reloadScenes } = useApi<{ scenes: SceneData[] }>(`/api/projects/${id}/scenes`);
  const { data: status } = useApi<{ capabilities: { anthropic: boolean; openaiCompat: boolean } }>("/api/status");
  const [jobId, setJobId] = useState<string | null>(search.get("job"));
  const [variation, setVariation] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<StorySettingsValue | null>(null);
  const [meta, setMeta] = useState<{ title: string; hook: string; logline: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const job = useJob(jobId, async (j) => {
    if (j.status === "failed") setError(j.error);
    else if (j.message && /English only/.test(j.message)) toast(j.message, "info");
    await Promise.all([reload(), reloadScenes()]);
    setJobId(null);
  });

  const project = data?.project;
  const scenes = scenesData?.scenes ?? [];
  const cast = data?.characters.map((c) => c.name) ?? [];
  const total = scenes.reduce((a, s) => a + s.durationSec, 0);
  const locked = !!project?.scriptApproved;

  async function regenerate() {
    if (!project) return;
    if (scenes.length) {
      const ok = await confirm({
        title: "Rewrite the whole story?",
        body: "This replaces every scene, including storyboards and clips attached to them. Your Character Bible is kept and reused.",
        confirmLabel: "Rewrite story",
        tone: "danger",
      });
      if (!ok) return;
    }
    setError(null);
    const next = variation + 1;
    setVariation(next);
    try {
      const r = await callPaid<{ job: { id: string } }>(`/api/projects/${id}/story`, { variation: next, settings: settings ?? project.settings }, confirm, "Rewriting this story");
      if (r) setJobId(r.job.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const order = scenes.map((s) => s.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await api(`/api/projects/${id}/scenes/reorder`, { body: { order } });
    reloadScenes();
  }
  async function del(sc: SceneData) {
    if (!(await confirm({ title: `Delete scene ${sc.idx + 1}?`, body: "Its storyboard and clips are removed from the edit.", confirmLabel: "Delete", tone: "danger" }))) return;
    await api(`/api/projects/${id}/scenes/${sc.id}`, { method: "DELETE" });
    reloadScenes();
    reload();
  }
  async function addScene() {
    await api(`/api/projects/${id}/scenes`, { body: { scene: { characters: cast.slice(0, 1) } } });
    reloadScenes();
  }
  async function saveMeta() {
    if (!meta) return;
    await api(`/api/projects/${id}/story`, { method: "PATCH", body: meta });
    setMeta(null);
    toast("Story details saved");
    reload();
  }
  async function approve(approved: boolean) {
    await api(`/api/projects/${id}/story`, { method: "PUT", body: { approved } });
    await reload();
    if (approved) router.push(`/projects/${id}/storyboard`);
  }

  if (!project) return <div className="shimmer h-64 rounded-2xl" />;
  const generating = !!jobId && (!job || job.status === "queued" || job.status === "running");

  return (
    <div className="space-y-5">
      {generating && (
        <Card className="p-5">
          <div className="mb-2 text-sm text-ink-300">✎ {job?.message ?? "Queued…"}</div>
          <Progress value={job?.progress ?? 0.05} />
        </Card>
      )}
      <ErrorBox error={error} />

      {!project.story && !generating ? (
        <Empty title="No script yet" action={<Button variant="primary" onClick={regenerate}>✦ Write the story</Button>}>
          {project.idea}
        </Empty>
      ) : project.story ? (
        <>
          <Card className="p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title">
                  <input disabled={locked} value={meta?.title ?? project.story.title} onChange={(e) => setMeta({ title: e.target.value, hook: meta?.hook ?? project.story!.hook, logline: meta?.logline ?? project.story!.logline })} />
                </Field>
                <Field label="Opening hook (first 1–2 seconds)">
                  <input disabled={locked} value={meta?.hook ?? project.story.hook} onChange={(e) => setMeta({ hook: e.target.value, title: meta?.title ?? project.story!.title, logline: meta?.logline ?? project.story!.logline })} />
                </Field>
                <Field label="Logline" className="sm:col-span-2">
                  <input disabled={locked} value={meta?.logline ?? project.story.logline} onChange={(e) => setMeta({ logline: e.target.value, title: meta?.title ?? project.story!.title, hook: meta?.hook ?? project.story!.hook })} />
                </Field>
              </div>
              <div className="flex flex-col items-stretch gap-2 lg:w-56">
                {meta && <Button variant="primary" onClick={saveMeta}>Save details</Button>}
                <div className={`rounded-xl border p-3 text-center ${Math.abs(total - project.settings.durationSec) > 1 ? "border-amber-500/40 text-amber-300" : "border-ink-700 text-ink-300"}`}>
                  <div className="font-display text-2xl font-bold">{total.toFixed(1)}s</div>
                  <div className="text-xs">target {project.settings.durationSec}s · {scenes.length} scenes</div>
                </div>
                <div className="text-xs text-ink-500">Cast: {cast.join(", ") || "—"} · <Link className="underline" href={`/projects/${id}/storyboard`}>Character Bible</Link></div>
              </div>
            </div>
          </Card>

          {locked ? (
            <Notice tone="ok" className="flex flex-wrap items-center justify-between gap-2">
              <span>✓ Script approved and locked. Unlock to edit — your storyboards and clips stay attached.</span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => approve(false)}>Unlock to edit</Button>
                <Link href={`/projects/${id}/storyboard`}><Button size="sm" variant="primary">Go to storyboard →</Button></Link>
              </span>
            </Notice>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowSettings((x) => !x)}>⚙ Story settings</Button>
                <Button onClick={regenerate} disabled={generating}>↻ Rewrite story</Button>
              </div>
              <Button variant="primary" onClick={() => approve(true)} disabled={generating || scenes.length < 2}>✓ Approve script</Button>
            </div>
          )}
          {showSettings && !locked && (
            <Card className="p-5">
              <StorySettingsForm value={settings ?? project.settings} onChange={setSettings} caps={status?.capabilities} />
              <p className="mt-3 text-xs text-ink-500">New settings apply when you click “Rewrite story”.</p>
            </Card>
          )}

          <div className="space-y-4">
            {scenes.map((sc, i) => (
              <SceneScriptEditor key={sc.id} projectId={id} scene={sc} cast={cast} locked={locked} first={i === 0} last={i === scenes.length - 1} onMove={(d) => move(i, d)} onDelete={() => del(sc)} onChanged={() => { reloadScenes(); reload(); }} />
            ))}
          </div>
          {!locked && scenes.length < 12 && (
            <Button variant="ghost" onClick={addScene}>+ Add scene</Button>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <StoryPage />
    </Suspense>
  );
}
