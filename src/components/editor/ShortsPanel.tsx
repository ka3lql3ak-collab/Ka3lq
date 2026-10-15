"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Button, Card, Field, Notice, useToast } from "../ui";

interface Content {
  hooks: string[];
  titles: string[];
  description: string;
  hashtags: string[];
  pinnedComment: string;
  coverSuggestions: { sceneIndex: number; reason: string; atSec: number }[];
}

export function ShortsPanel({ projectId, finalRenderId, srtUrl, vttUrl }: { projectId: string; finalRenderId: string | null; srtUrl: string | null; vttUrl: string | null }) {
  const { data, reload } = useApi<{ content: Content | null }>(`/api/projects/${projectId}/content`);
  const { data: covers, reload: reloadCovers } = useApi<{ covers: { id: string; url: string; meta: { renderId?: string; atSec?: number } }[] }>(`/api/projects/${projectId}/covers`);
  const [c, setC] = useState<Content | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (data?.content) setC(data.content);
  }, [data]);
  if (!c) return null;
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Copied"), () => toast("Copy failed", "error"));
  const dirty = JSON.stringify(c) !== JSON.stringify(data?.content);

  async function save() {
    setBusy("save");
    try {
      await api(`/api/projects/${projectId}/content`, { method: "PUT", body: c });
      toast("Saved");
      reload();
    } finally {
      setBusy(null);
    }
  }
  async function refresh() {
    setBusy("refresh");
    try {
      await api(`/api/projects/${projectId}/content`, { body: {} });
      setC(null);
      await reload();
    } finally {
      setBusy(null);
    }
  }
  async function makeCovers() {
    if (!finalRenderId) return;
    setBusy("covers");
    try {
      await api(`/api/projects/${projectId}/covers`, { body: { renderId: finalRenderId } });
      reloadCovers();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }
  const list = (k: "hooks" | "titles", label: string) => (
    <Field label={label}>
      <div className="space-y-1.5">
        {c[k].map((v, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={v} onChange={(e) => setC({ ...c, [k]: c[k].map((x, j) => (j === i ? e.target.value : x)) })} />
            <Button size="sm" variant="ghost" onClick={() => copy(v)} aria-label="Copy">⧉</Button>
          </div>
        ))}
      </div>
    </Field>
  );
  const myCovers = covers?.covers.filter((x) => x.meta.renderId === finalRenderId) ?? [];

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg font-semibold text-white">YouTube Shorts kit</div>
          <div className="text-xs text-ink-400">Suggestions to help viewers understand the story at a glance. No title or hashtag guarantees views.</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={refresh} loading={busy === "refresh"}>↻ Rebuild from script</Button>
          <Button size="sm" variant="primary" onClick={save} disabled={!dirty} loading={busy === "save"}>Save</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {list("hooks", "Alternative opening hooks")}
        {list("titles", "Title options")}
        <Field label="Description" className="lg:col-span-2">
          <div className="flex gap-1.5">
            <textarea rows={4} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => copy(`${c.description}\n\n${c.hashtags.join(" ")}`)} aria-label="Copy description">⧉</Button>
          </div>
        </Field>
        <Field label="Hashtags">
          <input value={c.hashtags.join(" ")} onChange={(e) => setC({ ...c, hashtags: e.target.value.split(/\s+/).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)) })} />
        </Field>
        <Field label="Pinned comment">
          <div className="flex gap-1.5">
            <input value={c.pinnedComment} onChange={(e) => setC({ ...c, pinnedComment: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => copy(c.pinnedComment)} aria-label="Copy">⧉</Button>
          </div>
        </Field>
        <Field label="Cover / thumbnail frames" className="lg:col-span-2">
          <ul className="mb-2 space-y-0.5 text-xs text-ink-400">
            {c.coverSuggestions.map((s, i) => (
              <li key={i}>• {s.atSec.toFixed(1)}s (scene {s.sceneIndex + 1}): {s.reason}</li>
            ))}
          </ul>
          {finalRenderId ? (
            <>
              <Button size="sm" onClick={makeCovers} loading={busy === "covers"} disabled={myCovers.length > 0}>Extract cover frames from final render</Button>
              <div className="mt-2 flex flex-wrap gap-2">
                {myCovers.map((cv) => (
                  <a key={cv.id} href={`${cv.url}?download=1`} className="block w-24 overflow-hidden rounded-lg border border-ink-700" title="Download">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cv.url} alt="Cover frame" className="aspect-[9/16] w-full object-cover" />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <Notice tone="info" className="text-xs">Render the final video to extract cover frames.</Notice>
          )}
        </Field>
        <Field label="Caption files">
          <div className="flex gap-2">
            {srtUrl ? <a className="text-sm text-peach-400 underline" href={`${srtUrl}?download=1`}>captions.srt</a> : <span className="text-xs text-ink-500">Render to create caption files</span>}
            {vttUrl && <a className="text-sm text-peach-400 underline" href={`${vttUrl}?download=1`}>captions.vtt</a>}
          </div>
        </Field>
      </div>
    </Card>
  );
}
