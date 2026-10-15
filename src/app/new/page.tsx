"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, useApi } from "@/lib/client";
import { callPaid } from "@/lib/paid";
import { Button, Card, ErrorBox, Notice, PageHeader, useConfirm } from "@/components/ui";
import { DEFAULT_STORY_SETTINGS, StorySettingsForm, type StorySettingsValue } from "@/components/StorySettingsForm";

function NewStory() {
  const params = useSearchParams();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: status } = useApi<{ capabilities: { anthropic: boolean; openaiCompat: boolean } }>("/api/status");
  const [v, setV] = useState<StorySettingsValue>({ ...DEFAULT_STORY_SETTINGS, idea: params.get("idea") ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { project } = await api<{ project: { id: string } }>("/api/projects", { body: { settings: v } });
      const r = await callPaid<{ job: { id: string } }>(`/api/projects/${project.id}/story`, { variation: 0 }, confirm, "Writing this story");
      router.push(`/projects/${project.id}/story${r ? `?job=${r.job.id}` : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="New story" title="What's the story?" subtitle="Set the shape of your Short. You'll review and edit the full script before anything is animated." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["🍓 Cute family-film fruit", "Round, big-eyed Pixar-style fruit friends. Wholesome stories.", { visualStyle: "3d family film", genre: "wholesome", characterCount: 2 }, "A lonely strawberry finds a tiny abandoned orange and decides to help it."],
            ["🍌 Fruit people · villa drama", "Human bodies with realistic fruit heads, luxury resort, reality-show drama (the viral TikTok look).", { visualStyle: "fruit people", genre: "drama", characterCount: 4, dialogueStyle: "witty", narratorStyle: "dramatic trailer" }, "A strawberry, a banana and a watermelon all want to couple up with the new pear in the villa."],
          ] as const
        ).map(([name, desc, preset, example]) => {
          const on = v.visualStyle === preset.visualStyle;
          return (
            <button key={name} type="button" onClick={() => setV({ ...v, ...preset, idea: v.idea.trim() ? v.idea : example })} className={`rounded-2xl border p-4 text-left transition ${on ? "border-peach-500 bg-peach-500/10" : "border-ink-700 bg-ink-900/70 hover:border-ink-500"}`}>
              <div className="font-display font-semibold text-white">{name}</div>
              <div className="mt-1 text-sm text-ink-400">{desc}</div>
            </button>
          );
        })}
      </div>
      <Card className="p-6">
        <StorySettingsForm value={v} onChange={setV} caps={status?.capabilities} />
        <ErrorBox error={error} className="mt-4" />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-5">
          <div className="text-xs text-ink-500">Next: script → characters → storyboard (all free) → AI clips (paid, with confirmation).</div>
          <Button variant="primary" size="lg" loading={busy} disabled={v.idea.trim().length < 8} onClick={create}>
            ✦ Write my story
          </Button>
        </div>
      </Card>
      <Notice tone="info" className="mt-4">
        <b>Tip:</b> name the fruits and the emotional turn in one sentence — “A grumpy lemon is forced to babysit three blueberries and secretly loves it.”
      </Notice>
    </div>
  );
}

export default function NewStoryPage() {
  return (
    <Suspense>
      <NewStory />
    </Suspense>
  );
}
