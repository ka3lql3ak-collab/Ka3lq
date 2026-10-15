"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApi, money } from "@/lib/client";
import { Button, Card, Notice, PageHeader } from "@/components/ui";
import { ProjectLibrary } from "@/components/ProjectLibrary";

interface Status {
  capabilities: { demoMode: boolean; forceDemo: boolean; higgsfield: boolean; luma: boolean; anthropic: boolean; openaiCompat: boolean; flite: boolean; ffmpeg: boolean; piper: boolean };
  counts: { projects: number; characters: number; activeJobs: number; activeGenerations: number; exports: number };
  monthSpend: number;
}

const PIPELINE = [
  ["Idea", "free"],
  ["Story", "free"],
  ["Characters", "free"],
  ["Storyboard", "free"],
  ["AI video clips", "paid"],
  ["Voiceover", "free"],
  ["SFX", "free"],
  ["Captions", "free"],
  ["Edit", "free"],
  ["Your approval", "you"],
  ["MP4 export", "free"],
] as const;

export default function Dashboard() {
  const { data } = useApi<Status>("/api/status", 10000);
  const [idea, setIdea] = useState("");
  const router = useRouter();
  const caps = data?.capabilities;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Dashboard" title="Make something adorable today" subtitle="Turn a one-line idea into a cinematic 3D fruit-character YouTube Short. You approve every step and every cent before it's spent." />

      {caps?.demoMode && (
        <Notice tone="demo" className="mb-6">
          <b>Demo mode.</b> {caps.forceDemo ? "DEMO_MODE=true is set." : "The Higgsfield API isn't configured yet (HF_KEY)."} Stories, storyboards, voices, captions and rendering all work for free. You can generate clips in the Higgsfield app and import them per scene, or make
          <b> local placeholder animations of your storyboard</b>, watermarked “DEMO — not AI video”, which are never presented as AI-generated. <Link href="/settings" className="underline">Set up Higgsfield →</Link>
        </Notice>
      )}

      <Card className="mb-6 overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/new?idea=${encodeURIComponent(idea)}`);
            }}
            className="space-y-3"
          >
            <label htmlFor="quick-idea">Quick start</label>
            <textarea id="quick-idea" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="A lonely strawberry finds a tiny abandoned orange and decides to help it." />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" type="submit" disabled={idea.trim().length < 8}>✦ Develop this idea</Button>
              <Button type="button" variant="ghost" onClick={() => setIdea("A lonely strawberry finds a tiny abandoned orange and decides to help it.")}>Use example</Button>
            </div>
          </form>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Projects" value={data?.counts.projects} />
            <Stat label="Characters" value={data?.counts.characters} />
            <Stat label="Active jobs" value={data ? data.counts.activeJobs + data.counts.activeGenerations : undefined} href="/queue" />
            <Stat label="Spent this month" value={data ? money(data.monthSpend) : undefined} href="/settings" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-800 bg-ink-950/40 px-6 py-3 text-xs">
          {PIPELINE.map(([name, cost], i) => (
            <span key={name} className="flex items-center gap-1.5">
              <span className={`rounded-md border px-2 py-0.5 ${cost === "paid" ? "border-berry-500/40 text-berry-400" : cost === "you" ? "border-sky-400/40 text-sky-300" : "border-ink-700 text-ink-300"}`}>
                {name}
                {cost === "paid" && " $"}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-ink-600">→</span>}
            </span>
          ))}
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-white">Project library</h2>
        <Link href="/new"><Button size="sm" variant="primary">✦ New story</Button></Link>
      </div>
      <ProjectLibrary />

      {caps && (
        <Card className="mt-8 p-5">
          <div className="mb-3 font-display font-semibold text-white">Service status</div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Svc ok={caps.ffmpeg} name="FFmpeg rendering" detail={caps.ffmpeg ? "Installed" : "Install FFmpeg"} />
            <Svc ok={caps.flite} name="Local voices (flite)" detail={caps.flite ? "Free, built into FFmpeg" : "FFmpeg lacks libflite"} />
            <Svc ok={caps.higgsfield} name="Higgsfield video (preferred)" detail={caps.higgsfield ? "API configured (paid)" : "Needs HF_KEY · or import from the app"} />
            <Svc ok={caps.anthropic || caps.openaiCompat} optional name="LLM story writer" detail={caps.anthropic ? "Anthropic" : caps.openaiCompat ? "OpenAI-compatible" : "Optional — local composer in use"} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const inner = (
    <div className="h-full rounded-xl border border-ink-800 bg-ink-950/40 p-4 transition hover:border-ink-600">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-white">{value ?? <span className="shimmer inline-block h-6 w-10 rounded" />}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Svc({ ok, name, detail, optional }: { ok: boolean; name: string; detail: string; optional?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-ink-950/40 p-3">
      <span className={ok ? "text-lime-400" : optional ? "text-ink-500" : "text-amber-300"}>{ok ? "●" : "○"}</span>
      <div>
        <div className="font-medium text-ink-200">{name}</div>
        <div className="text-xs text-ink-500">{detail}</div>
      </div>
    </div>
  );
}
