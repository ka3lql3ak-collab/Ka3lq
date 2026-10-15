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
