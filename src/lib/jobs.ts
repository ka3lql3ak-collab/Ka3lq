import "server-only";
import { db, now, parseJson } from "./db";
import { newId } from "./paths";
import { log, redact } from "./log";
import type { JobStatus } from "./types";

export interface Job<P = Record<string, unknown>> {
  id: string;
  projectId: string | null;
  type: string;
  payload: P;
  status: JobStatus;
  progress: number;
  message: string | null;
  error: string | null;
  result: unknown;
  attempts: number;
  createdAt: number;
  updatedAt: number;
}

interface JobRow {
  id: string;
  project_id: string | null;
  type: string;
  payload_json: string;
  status: JobStatus;
  progress: number;
  message: string | null;
  error: string | null;
  result_json: string | null;
  attempts: number;
  run_after: number;
  created_at: number;
  updated_at: number;
}

const toJob = (r: JobRow): Job => ({
  id: r.id,
  projectId: r.project_id,
  type: r.type,
  payload: parseJson(r.payload_json, {}),
  status: r.status,
  progress: r.progress,
  message: r.message,
  error: r.error,
  result: parseJson(r.result_json, null),
  attempts: r.attempts,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface JobContext {
  job: Job;
  progress(p: number, message?: string): void;
  isCancelled(): boolean;
}

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

type G = typeof globalThis & {
  __fruitHandlers?: Map<string, JobHandler>;
  __fruitWorker?: { timer: NodeJS.Timeout; running: Set<string> };
};
const g = globalThis as G;
const handlers = (g.__fruitHandlers ??= new Map());

export function registerHandler(type: string, h: JobHandler) {
  handlers.set(type, h);
}

export function enqueue(type: string, payload: Record<string, unknown>, projectId?: string | null, opts: { dedupeKey?: string } = {}): Job {
  // Avoid stacking identical work (e.g. double-clicks) for the same target.
  if (opts.dedupeKey) {
    const existing = db()
      .prepare("SELECT * FROM jobs WHERE type = ? AND status IN ('queued','running') AND json_extract(payload_json,'$._dedupe') = ?")
      .get(type, opts.dedupeKey) as JobRow | undefined;
    if (existing) return toJob(existing);
  }
  const id = newId("j_");
  const t = now();
  db()
    .prepare("INSERT INTO jobs(id,project_id,type,payload_json,status,created_at,updated_at) VALUES (?,?,?,?, 'queued', ?, ?)")
    .run(id, projectId ?? null, type, JSON.stringify({ ...payload, ...(opts.dedupeKey ? { _dedupe: opts.dedupeKey } : {}) }), t, t);
  kick();
  return getJob(id)!;
}

export function getJob(id: string): Job | null {
  const r = db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  return r ? toJob(r) : null;
}

export function listJobs(f: { projectId?: string; status?: string; limit?: number } = {}): Job[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.projectId) (where.push("project_id = ?"), args.push(f.projectId));
  if (f.status) (where.push("status = ?"), args.push(f.status));
  const rows = db()
    .prepare(`SELECT * FROM jobs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`)
    .all(...args, f.limit ?? 100) as JobRow[];
  return rows.map(toJob);
}

export function cancelJob(id: string): boolean {
  const r = db().prepare("UPDATE jobs SET status='cancelled', message='Cancelled by user', updated_at=? WHERE id=? AND status IN ('queued','running')").run(now(), id);
  return r.changes > 0;
}

function update(id: string, f: Partial<{ status: JobStatus; progress: number; message: string | null; error: string | null; result: unknown }>) {
  const sets: string[] = ["updated_at = ?"];
  const args: unknown[] = [now()];
  if (f.status) (sets.push("status = ?"), args.push(f.status));
  if (f.progress !== undefined) (sets.push("progress = ?"), args.push(Math.max(0, Math.min(1, f.progress))));
  if (f.message !== undefined) (sets.push("message = ?"), args.push(f.message));
  if (f.error !== undefined) (sets.push("error = ?"), args.push(f.error));
  if (f.result !== undefined) (sets.push("result_json = ?"), args.push(JSON.stringify(f.result)));
  args.push(id);
  // Never overwrite a cancellation.
  db().prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ? AND status != 'cancelled'`).run(...args);
}

function claimNext(): Job | null {
  const r = db()
    .prepare(
      `UPDATE jobs SET status='running', attempts = attempts + 1, updated_at = ?
       WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_after <= ? ORDER BY created_at LIMIT 1)
       RETURNING *`,
    )
    .get(now(), now()) as JobRow | undefined;
  return r ? toJob(r) : null;
}

/** Run a single job to completion (used by the worker loop and by tests). */
export async function runJob(job: Job): Promise<void> {
  const handler = handlers.get(job.type);
  if (!handler) {
    update(job.id, { status: "failed", error: `No handler for job type ${job.type}` });
    return;
  }
  const ctx: JobContext = {
    job,
    progress: (p, message) => update(job.id, { progress: p, ...(message !== undefined ? { message } : {}) }),
    isCancelled: () => getJob(job.id)?.status === "cancelled",
  };
  try {
    const result = await handler(ctx);
    if (!ctx.isCancelled()) update(job.id, { status: "done", progress: 1, result: result ?? null, error: null });
  } catch (e) {
    const msg = redact(e);
    log.error(`job ${job.type} ${job.id} failed: ${msg}`);
    update(job.id, { status: "failed", error: msg });
  }
}

/** Process queued jobs until none remain (tests / CLI). */
export async function drainJobs(maxJobs = 50) {
  for (let i = 0; i < maxJobs; i++) {
    const j = claimNext();
    if (!j) return;
    await runJob(j);
  }
}

const MAX_CONCURRENT = 2;
const pollers: Array<() => Promise<void>> = [];
export function registerPoller(fn: () => Promise<void>) {
  pollers.push(fn);
}

function kick() {
  const w = g.__fruitWorker;
  if (!w) return;
  setImmediate(tick);
}

let pollerBusy = false;
let lastPoll = 0;
async function tick() {
  const w = g.__fruitWorker;
  if (!w) return;
  while (w.running.size < MAX_CONCURRENT) {
    const j = claimNext();
    if (!j) break;
    w.running.add(j.id);
    runJob(j).finally(() => {
      w.running.delete(j.id);
      kick();
    });
  }
  if (!pollerBusy && Date.now() - lastPoll > 4000) {
    pollerBusy = true;
    lastPoll = Date.now();
    try {
      for (const p of pollers) await p().catch((e) => log.error("poller error", redact(e)));
    } finally {
      pollerBusy = false;
    }
  }
}

/** Start the in-process worker. Safe to call multiple times. */
export function startWorker() {
  if (g.__fruitWorker) return;
  // Jobs interrupted by a restart are re-queued; their handlers are written to be re-runnable.
  const r = db().prepare("UPDATE jobs SET status='queued', message='Resumed after server restart', updated_at=? WHERE status='running'").run(now());
  if (r.changes) log.info(`re-queued ${r.changes} interrupted job(s)`);
  g.__fruitWorker = { timer: setInterval(tick, 1000), running: new Set() };
  g.__fruitWorker.timer.unref?.();
  log.info("background worker started");
}
