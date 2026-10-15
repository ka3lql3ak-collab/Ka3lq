"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useApi, money } from "@/lib/client";
import { Badge, ErrorBox, cx } from "@/components/ui";
import { ProjectCtx, type ProjectData } from "@/components/ProjectContext";

const TABS = [
  ["story", "1 · Script"],
  ["storyboard", "2 · Characters & Storyboard"],
  ["scenes", "3 · AI Clips"],
  ["editor", "4 · Edit & Export"],
] as const;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data, error, reload } = useApi<ProjectData>(`/api/projects/${id}`);
  return (
    <ProjectCtx.Provider value={{ data, reload }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="text-xs text-ink-500 hover:text-ink-300">← All projects</Link>
            <h1 className="truncate font-display text-2xl font-bold text-white">{data?.project.title ?? <span className="shimmer inline-block h-7 w-64 rounded" />}</h1>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <Badge tone="running">{data.summary.stage}</Badge>
              <span>{data.summary.sceneCount} scenes</span>·<span>{data.summary.clipCount} clips</span>·<span>spent {money(data.summary.spent)}</span>
            </div>
          )}
        </div>
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-ink-800 bg-ink-900/60 p-1 scroll-thin">
          {TABS.map(([seg, label]) => {
            const active = pathname.endsWith(`/${seg}`);
            return (
              <Link key={seg} href={`/projects/${id}/${seg}`} className={cx("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition", active ? "bg-ink-700 text-white" : "text-ink-400 hover:text-ink-200")}>
                {label}
              </Link>
            );
          })}
        </div>
        <ErrorBox error={error} className="mb-4" />
        {children}
      </div>
    </ProjectCtx.Provider>
  );
}
