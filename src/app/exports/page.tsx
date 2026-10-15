"use client";
import Link from "next/link";
import { useState } from "react";
import { api, ago, useApi } from "@/lib/client";
import { Badge, Button, Card, Empty, PageHeader, useConfirm, useToast } from "@/components/ui";

interface Exp {
  id: string;
  projectId: string;
  projectTitle: string | null;
  title: string;
  url: string;
  downloadUrl: string;
  srtUrl: string | null;
  vttUrl: string | null;
  isDemo: boolean;
  sizeBytes: number | null;
  durationSec: number | null;
  createdAt: number;
}

export default function ExportsPage() {
  const [q, setQ] = useState("");
  const { data, reload } = useApi<{ exports: Exp[] }>(`/api/exports${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const confirm = useConfirm();
  const toast = useToast();
  async function remove(e: Exp) {
    if (!(await confirm({ title: "Delete this export?", body: "Removes the MP4 and caption files from the library. The project and its renders are kept.", confirmLabel: "Delete", tone: "danger" }))) return;
    await api(`/api/exports/${e.id}`, { method: "DELETE" });
    toast("Export deleted");
    reload();
  }
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Export library" title="Finished Shorts" subtitle="Approved final renders: vertical 1080×1920 H.264/AAC MP4s with SRT/VTT caption files, ready to upload." />
      <input placeholder="Search exports…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" aria-label="Search exports" />
      {data?.exports.length === 0 ? (
        <Empty title="No exports yet" action={<Link href="/"><Button variant="primary">Open a project</Button></Link>}>Render a final video in a project&apos;s editor, approve it, then export.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.exports.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <video src={e.url} controls playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-contain" />
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/projects/${e.projectId}/editor`} className="line-clamp-2 font-semibold text-white hover:underline">{e.title}</Link>
                  {e.isDemo && <Badge tone="demo">demo</Badge>}
                </div>
                <div className="text-xs text-ink-500">{e.durationSec?.toFixed(1)}s · {e.sizeBytes ? (e.sizeBytes / 1024 / 1024).toFixed(1) : "?"} MB · {ago(e.createdAt)}</div>
                <div className="flex flex-wrap gap-1.5">
                  <a href={e.downloadUrl}><Button size="sm" variant="primary">⬇ MP4</Button></a>
                  {e.srtUrl && <a href={e.srtUrl}><Button size="sm">SRT</Button></a>}
                  {e.vttUrl && <a href={e.vttUrl}><Button size="sm">VTT</Button></a>}
                  <Button size="sm" variant="ghost" className="ml-auto hover:text-berry-400" onClick={() => remove(e)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
