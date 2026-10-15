"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApi, ago, money } from "@/lib/client";
import { Badge, Button, Card, Empty, ErrorBox, Progress, useConfirm, useToast, cx } from "./ui";

export interface ProjectSummary {
  id: string;
  title: string;
  idea: string;
  genre: string;
  durationSec: number;
  archived: boolean;
  updatedAt: number;
  sceneCount: number;
  approvedScenes: number;
  clipCount: number;
  storyboardCount: number;
  exportCount: number;
  coverUrl: string | null;
  spent: number;
  stage: string;
}

const STAGES = ["Idea", "Script", "Storyboard", "Animating", "Editing", "Exported"];
const GENRES = ["funny", "emotional", "wholesome", "adventure", "mystery", "twist", "drama"];

export function ProjectLibrary({ pick, limit }: { pick?: string | null; limit?: number }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [genre, setGenre] = useState("");
  const [archived, setArchived] = useState(false);
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (stage) params.set("stage", stage);
  if (genre) params.set("genre", genre);
  if (archived) params.set("archived", "1");
  const { data, error, loading, reload } = useApi<{ projects: ProjectSummary[] }>(`/api/projects?${params}`);
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const projects = limit ? data?.projects.slice(0, limit) : data?.projects;

  async function archive(p: ProjectSummary) {
    await api(`/api/projects/${p.id}`, { method: "PATCH", body: { archived: !p.archived } });
    toast(p.archived ? "Project restored" : "Project archived");
    reload();
  }
  async function remove(p: ProjectSummary) {
    const ok = await confirm({
      title: `Delete “${p.title}”?`,
      body: "This permanently deletes the project, its scenes, generated clips, audio and renders from this computer. Exports already downloaded are not affected.",
      confirmLabel: "Delete forever",
      tone: "danger",
    });
    if (!ok) return;
    await api(`/api/projects/${p.id}`, { method: "DELETE" });
    toast("Project deleted");
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search projects" />
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-auto" aria-label="Filter by stage">
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-auto" aria-label="Filter by genre">
          <option value="">All genres</option>
          {GENRES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 normal-case tracking-normal">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Archived
        </label>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-56 rounded-2xl" />
          ))}
        </div>
      ) : projects && projects.length === 0 ? (
        <Empty title={q || stage || genre || archived ? "No matching projects" : "No projects yet"} action={<Link href="/new"><Button variant="primary">✦ Start a new story</Button></Link>}>
          Every Short starts with a one-line idea. The free local story composer works without any API keys.
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects?.map((p) => {
            const href = `/projects/${p.id}/${pick ?? (p.stage === "Idea" || p.stage === "Script" ? "story" : p.stage === "Storyboard" ? "storyboard" : p.stage === "Animating" ? "scenes" : "editor")}`;
            const progress = p.sceneCount ? (STAGES.indexOf(p.stage) + (p.stage === "Animating" ? p.clipCount / p.sceneCount : 0)) / (STAGES.length - 1) : 0.05;
            return (
              <Card key={p.id} className="group overflow-hidden transition hover:border-peach-500/40">
                <button onClick={() => router.push(href)} className="block w-full text-left">
                  <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-ink-800 to-ink-850">
                    {p.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverUrl} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-105 group-hover:opacity-100" />
                    ) : (
                      <span className="text-5xl opacity-60">🍊</span>
                    )}
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      <Badge tone={p.stage === "Exported" ? "approved" : "running"}>{p.stage}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="line-clamp-1 font-display text-base font-semibold text-white">{p.title}</div>
                    <div className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-400">{p.idea}</div>
                    <Progress value={progress} />
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span className="capitalize">{p.genre}</span>
                      <span>{p.durationSec}s</span>
                      <span>{p.sceneCount} scenes</span>
                      <span>{p.clipCount} clips</span>
                      <span>spent {money(p.spent)}</span>
                      <span className="ml-auto">{ago(p.updatedAt)}</span>
                    </div>
                  </div>
                </button>
                <div className={cx("flex justify-end gap-1 border-t border-ink-800 px-3 py-2", pick && "hidden")}>
                  <Button size="sm" variant="ghost" onClick={() => archive(p)}>{p.archived ? "Restore" : "Archive"}</Button>
                  <Button size="sm" variant="ghost" className="hover:text-berry-400" onClick={() => remove(p)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
