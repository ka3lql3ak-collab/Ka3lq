import "server-only";
import { db, now } from "./db";
import { newId } from "./paths";
import { getSettings, type Settings } from "./settings";

export function estimateVideoCost(s: Settings, model: string, resolution: string, duration: string): number {
  const per5 = s.prices.video[model]?.[resolution];
  if (per5 === undefined) throw new Error(`No price configured for ${model} @ ${resolution}. Add it in Settings → Prices.`);
  return round2(duration === "9s" ? per5 * s.prices.ninesMultiplier : per5);
}

export function estimateImageCost(s: Settings, model: string): number {
  const p = s.prices.image[model];
  if (p === undefined) throw new Error(`No price configured for image model ${model}.`);
  return round2(p);
}

export function estimateHiggsfieldVideo(s: Settings, model: string): number {
  const p = s.prices.higgsfield.video[model];
  if (p === undefined) throw new Error(`No Higgsfield price configured for ${model}. Add it in Settings → Prices.`);
  return round2(p);
}

export function estimateHiggsfieldImage(s: Settings, quality: string): number {
  const p = s.prices.higgsfield.image[quality];
  if (p === undefined) throw new Error(`No Higgsfield image price configured for ${quality}.`);
  return round2(p);
}

export const round2 = (n: number) => Math.round(n * 1000) / 1000;

/** Money committed: actual cost where known, otherwise the estimate, for non-failed paid generations. */
export function committedSpend(filter: { projectId?: string; sceneId?: string; sinceMs?: number }): number {
  const where = ["is_paid = 1", "status NOT IN ('awaiting_approval','cancelled')", "NOT (status = 'failed' AND provider_job_id IS NULL)"];
  const args: unknown[] = [];
  if (filter.projectId) (where.push("project_id = ?"), args.push(filter.projectId));
  if (filter.sceneId) (where.push("scene_id = ?"), args.push(filter.sceneId));
  if (filter.sinceMs) (where.push("created_at >= ?"), args.push(filter.sinceMs));
  const row = db()
    .prepare(`SELECT COALESCE(SUM(COALESCE(actual_cost, estimated_cost)),0) AS total FROM generations WHERE ${where.join(" AND ")}`)
    .get(...args) as { total: number };
  return round2(row.total);
}

export interface BudgetCheck {
  ok: boolean;
  estimate: number;
  reasons: string[];
  sceneSpent: number;
  projectSpent: number;
  monthSpent: number;
  limits: Settings["budget"];
}

export function checkBudget(opts: { projectId?: string | null; sceneId?: string | null; estimate: number; projectBudget?: number | null }): BudgetCheck {
  const s = getSettings();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const sceneSpent = opts.sceneId ? committedSpend({ sceneId: opts.sceneId }) : 0;
  const projectSpent = opts.projectId ? committedSpend({ projectId: opts.projectId }) : 0;
  const monthSpent = committedSpend({ sinceMs: monthStart.getTime() });
  const projectLimit = opts.projectBudget ?? s.budget.perProjectUsd;
  const reasons: string[] = [];
  const e = opts.estimate;
  if (opts.sceneId && sceneSpent + e > s.budget.perSceneUsd + 1e-9)
    reasons.push(`Scene budget: $${sceneSpent.toFixed(2)} spent + $${e.toFixed(2)} would exceed the $${s.budget.perSceneUsd.toFixed(2)} per-scene limit.`);
  if (opts.projectId && projectSpent + e > projectLimit + 1e-9)
    reasons.push(`Project budget: $${projectSpent.toFixed(2)} spent + $${e.toFixed(2)} would exceed the $${projectLimit.toFixed(2)} project limit.`);
  if (monthSpent + e > s.budget.monthlyUsd + 1e-9)
    reasons.push(`Monthly budget: $${monthSpent.toFixed(2)} spent + $${e.toFixed(2)} would exceed the $${s.budget.monthlyUsd.toFixed(2)} monthly limit.`);
  return { ok: reasons.length === 0, estimate: e, reasons, sceneSpent, projectSpent, monthSpent, limits: { ...s.budget, perProjectUsd: projectLimit } };
}

export function ledger(entry: { projectId?: string | null; generationId?: string | null; provider: string; kind: string; estimated: number; actual?: number | null; note?: string }) {
  db()
    .prepare("INSERT INTO cost_ledger(id,project_id,generation_id,provider,kind,estimated,actual,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(newId("c_"), entry.projectId ?? null, entry.generationId ?? null, entry.provider, entry.kind, entry.estimated, entry.actual ?? null, entry.note ?? null, now());
}
