"use client";
import Link from "next/link";
import { useState } from "react";
import { api, ago, money, useApi } from "@/lib/client";
import { Badge, Button, Card, Empty, PageHeader, Progress, Tabs, useToast } from "@/components/ui";
import { providerLabel } from "@/lib/labels";

interface Render {
  id: string;
  projectId: string;
  projectTitle: string;
  quality: string;
  status: string;
  progress: number;
  isDemo: boolean;
  approval: string;
  error: string | null;
  log: string | null;
  createdAt: number;
}
interface Job {
  id: string;
  projectId: string | null;
  type: string;
  status: string;
  progress: number;
  message: string | null;
  error: string | null;
  createdAt: number;
}
interface Gen {
  id: string;
  kind: string;
  provider: string;
  model: string;
  status: string;
  estimatedCost: number;
  isPaid: boolean;
  error: string | null;
  createdAt: number;
}

const ACTIVE = ["queued", "running", "submitting", "submitted", "generating", "unknown"];

export default function QueuePage() {
  const [tab, setTab] = useState<"active" | "all">("active");
  const poll = 2000;
  const { data: rd, reload: rr } = useApi<{ renders: Render[] }>("/api/renders", poll);
  const { data: jd, reload: rj } = useApi<{ jobs: Job[] }>("/api/jobs", poll);
  const { data: gd, reload: rg } = useApi<{ generations: Gen[] }>("/api/generations", poll);
  const toast = useToast();
  const f = <T extends { status: string }>(xs: T[] | undefined) => (xs ?? []).filter((x) => tab === "all" || ACTIVE.includes(x.status));
  const renders = f(rd?.renders);
  const gens = f(gd?.generations);
  const jobs = f(jd?.jobs).filter((j) => j.type !== "render");

  async function cancelRender(r: Render) {
    await api(`/api/projects/${r.projectId}/renders/${r.id}/cancel`, { body: {} });
    rr();
  }
  async function cancelGen(g: Gen) {
    const r = await api<{ generation: Gen }>(`/api/generations/${g.id}/cancel`, { body: {} });
    toast(r.generation.error ?? "Cancelled", "info");
    rg();
  }
  async function cancelJob(j: Job) {
    await api(`/api/jobs/${j.id}/cancel`, { body: {} });
    rj();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Render queue" title="Everything in progress" subtitle="Renders, AI generations and background jobs. Job state is stored in the database, so it survives restarts." actions={<Tabs value={tab} onChange={setTab} items={[{ value: "active", label: "Active" }, { value: "all", label: "History" }]} />} />
      <div className="space-y-6">
        <Section title="Renders" empty={!renders.length}>
          {renders.map((r) => (
            <Row key={r.id}>
              <Badge tone={r.status}>{r.status}</Badge>
              <Link href={`/projects/${r.projectId}/editor`} className="font-semibold text-white hover:underline">{r.projectTitle}</Link>
              <span className="text-xs text-ink-400">{r.quality}{r.isDemo ? " · demo" : ""}{r.approval === "approved" ? " · approved" : ""}</span>
              <span className="ml-auto text-xs text-ink-500">{ago(r.createdAt)}</span>
              {(r.status === "queued" || r.status === "running") && <Button size="sm" variant="danger" onClick={() => cancelRender(r)}>Cancel</Button>}
              {(r.status === "running" || r.status === "queued") && (
                <div className="w-full">
                  <div className="mb-1 truncate text-xs text-ink-500">{r.log?.split("\n").pop()}</div>
                  <Progress value={r.progress} />
                </div>
              )}
              {r.error && <div className="w-full text-xs text-berry-400">{r.error}</div>}
            </Row>
          ))}
        </Section>
        <Section title="AI generations" empty={!gens.length}>
          {gens.map((g) => (
            <Row key={g.id}>
              <Badge tone={g.status}>{g.status}</Badge>
              <span className="font-semibold text-white">{providerLabel(g.provider)}</span>
              <span className="text-xs text-ink-400">{g.kind} · {g.model}{g.isPaid ? ` · est. ${money(g.estimatedCost)}` : " · free"}</span>
              <span className="ml-auto text-xs text-ink-500">{ago(g.createdAt)}</span>
              {["queued", "submitted", "generating"].includes(g.status) && <Button size="sm" variant="danger" onClick={() => cancelGen(g)}>Cancel</Button>}
              {g.status === "unknown" && <Button size="sm" onClick={() => cancelGen(g)}>Dismiss</Button>}
              {g.error && <div className="w-full text-xs text-ink-400">{g.error}</div>}
            </Row>
          ))}
        </Section>
        <Section title="Background jobs" empty={!jobs.length}>
          {jobs.map((j) => (
            <Row key={j.id}>
              <Badge tone={j.status}>{j.status}</Badge>
              <span className="font-semibold text-white">{j.type}</span>
              <span className="truncate text-xs text-ink-400">{j.message}</span>
              <span className="ml-auto text-xs text-ink-500">{ago(j.createdAt)}</span>
              {(j.status === "queued" || j.status === "running") && <Button size="sm" variant="ghost" onClick={() => cancelJob(j)}>Cancel</Button>}
              {j.status === "running" && <Progress value={j.progress} className="w-full" />}
              {j.error && <div className="w-full text-xs text-berry-400">{j.error}</div>}
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-display text-lg font-semibold text-white">{title}</div>
      {empty ? <Empty title="Nothing here">Idle. Start something from a project.</Empty> : <Card className="divide-y divide-ink-800">{children}</Card>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">{children}</div>;
}
