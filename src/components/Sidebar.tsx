"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx, Badge } from "./ui";
import { useApi, money } from "@/lib/client";

interface Status {
  capabilities: { demoMode: boolean; higgsfield: boolean; luma: boolean; anthropic: boolean; openaiCompat: boolean; flite: boolean; ffmpeg: boolean };
  counts: { activeJobs: number; activeGenerations: number };
  monthSpend: number;
}

const ACTIVE_KEY = "fss.activeProject";

export function useActiveProject() {
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const m = /^\/projects\/([^/]+)/.exec(pathname);
    if (m) {
      setId(m[1]);
      try {
        localStorage.setItem(ACTIVE_KEY, m[1]);
      } catch {}
    } else {
      try {
        setId(localStorage.getItem(ACTIVE_KEY));
      } catch {}
    }
  }, [pathname]);
  return id;
}

export function Sidebar() {
  const pathname = usePathname();
  const active = useActiveProject();
  const { data } = useApi<Status>("/api/status", 5000);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const proj = (sub: string) => (active ? `/projects/${active}/${sub}` : `/projects?pick=${sub}`);
  const groups: { title: string; items: { href: string; label: string; icon: string; match?: RegExp }[] }[] = [
    {
      title: "Studio",
      items: [
        { href: "/", label: "Dashboard", icon: "◐", match: /^\/$|^\/projects$/ },
        { href: "/new", label: "New Story", icon: "✦", match: /^\/new/ },
        { href: "/characters", label: "Character Library", icon: "☺", match: /^\/characters/ },
      ],
    },
    {
      title: "Current project",
      items: [
        { href: proj("story"), label: "Script", icon: "✎", match: /\/story$/ },
        { href: proj("storyboard"), label: "Storyboard", icon: "▦", match: /\/storyboard$/ },
        { href: proj("scenes"), label: "Scene Generator", icon: "▶", match: /\/scenes$/ },
        { href: proj("editor"), label: "Video Editor", icon: "✂", match: /\/editor$/ },
      ],
    },
    {
      title: "Output",
      items: [
        { href: "/queue", label: "Render Queue", icon: "⧗", match: /^\/queue/ },
        { href: "/exports", label: "Export Library", icon: "⬇", match: /^\/exports/ },
        { href: "/settings", label: "Cost & API Settings", icon: "⚙", match: /^\/settings/ },
      ],
    },
  ];
  const busy = (data?.counts.activeJobs ?? 0) + (data?.counts.activeGenerations ?? 0);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-800 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          ☰
        </button>
      </div>
      <aside className={cx("z-30 w-full shrink-0 border-ink-800 bg-ink-950/80 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-r", open ? "block border-b" : "hidden lg:flex")}>
        <div className="hidden px-5 pt-6 pb-4 lg:block">
          <Logo />
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 scroll-thin">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">{g.title}</div>
              {g.items.map((i) => {
                const isActive = i.match ? i.match.test(pathname) : pathname === i.href;
                return (
                  <Link
                    key={i.label}
                    href={i.href}
                    className={cx(
                      "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                      isActive ? "bg-gradient-to-r from-peach-500/15 to-transparent text-white" : "text-ink-400 hover:bg-ink-850 hover:text-ink-200",
                    )}
                  >
                    <span className={cx("grid h-6 w-6 place-items-center rounded-md text-xs", isActive ? "bg-peach-500 text-ink-950" : "bg-ink-800 text-ink-400 group-hover:text-ink-200")}>{i.icon}</span>
                    {i.label}
                    {i.href === "/queue" && busy > 0 && <span className="ml-auto rounded-full bg-peach-500 px-1.5 text-[10px] font-bold text-ink-950">{busy}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t border-ink-800 px-5 py-4 text-xs">
          {data ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Mode</span>
                {data.capabilities.demoMode ? <Badge tone="demo">Demo mode</Badge> : <Badge tone="approved">Live · {data.capabilities.higgsfield ? "Higgsfield" : "Luma"}</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Spent this month</span>
                <span className="font-mono text-ink-300">{money(data.monthSpend)}</span>
              </div>
              {!data.capabilities.ffmpeg && <div className="text-berry-400">FFmpeg not found — rendering disabled</div>}
            </>
          ) : (
            <div className="shimmer h-8 rounded" />
          )}
        </div>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-peach-400 to-berry-500 text-lg shadow-lg shadow-berry-500/30">🍓</span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-bold text-white">Fruit Shorts</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">Studio</span>
      </span>
    </Link>
  );
}
