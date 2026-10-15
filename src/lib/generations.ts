import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import { db, now, parseJson } from "./db";
import { newId, mediaDir, toRel, uniqueFile } from "./paths";
import { log, redact } from "./log";
import { enqueue, registerHandler, registerPoller } from "./jobs";
import { checkBudget, ledger, round2 } from "./costs";
import { getSettings } from "./settings";
import { createAsset, getProject, getScene, setSceneFields, ConflictError, NotFoundError, PaymentRequiredError, ValidationError } from "./repo";
import { probe } from "./media/ffmpeg";
import { getProvider, extFor } from "./providers/registry";
import { ProviderError, UnknownOutcomeError, type GenerationRecord, type GenKind } from "./providers/types";
import type { GenerationStatus } from "./types";
import { toGenView, type GenerationView } from "./features/scene-view";

interface GenRow {
  id: string;
  project_id: string | null;
  scene_id: string | null;
  character_id: string | null;
  kind: GenKind;
  provider: string;
  model: string;
  prompt: string;
  params_json: string;
  status: GenerationStatus;
  provider_job_id: string | null;
  idempotency_key: string;
  estimated_cost: number;
  actual_cost: number | null;
  is_paid: number;
  is_demo: number;
  asset_id: string | null;
  error: string | null;
  poll_count: number;
  next_poll_at: number | null;
  submitted_at: number | null;
  created_at: number;
  updated_at: number;
}

const toRecord = (r: GenRow): GenerationRecord => ({
  id: r.id,
  projectId: r.project_id,
  sceneId: r.scene_id,
  characterId: r.character_id,
  kind: r.kind,
  provider: r.provider,
  model: r.model,
  prompt: r.prompt,
  params: parseJson(r.params_json, {}),
  providerJobId: r.provider_job_id,
  createdAt: r.created_at,
  submittedAt: r.submitted_at,
});

function row(id: string): GenRow | undefined {
  return db().prepare("SELECT * FROM generations WHERE id = ?").get(id) as GenRow | undefined;
}

export function getGeneration(id: string): GenerationView | null {
  const r = row(id);
  return r ? toGenView(r as never) : null;
}

function setGen(id: string, f: Partial<Record<string, unknown>>) {
  const keys = Object.keys(f);
  if (!keys.length) return;
  db()
    .prepare(`UPDATE generations SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => f[k] as never), now(), id);
}

export interface GenerationRequest {
  kind: GenKind;
  providerId: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  projectId?: string | null;
  sceneId?: string | null;
  characterId?: string | null;
  /** Client-generated id for this click. Repeated requests with the same id never create a second job. */
  requestId: string;
  confirmCost?: boolean;
  estimate?: number;
}

/**
 * Create a generation. Free providers run immediately. Paid providers require
 * `confirmCost` with the exact server estimate, and must fit every budget limit.
 * Identical requestIds are idempotent (protects against double clicks and timeouts).
 */
export function requestGeneration(req: GenerationRequest): { generation: GenerationView; reused: boolean } {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(req.requestId)) throw new ValidationError("A valid requestId is required.");
  const provider = getProvider(req.providerId);
  if (provider.kind !== req.kind) throw new ValidationError(`${provider.label} cannot generate ${req.kind}s.`);
  const cfg = provider.configured();
  if (!cfg.ok) throw new ValidationError(`${provider.label} is not configured: ${cfg.reason}`);
  if (!provider.models().some((m) => m.id === req.model)) throw new ValidationError(`Model "${req.model}" is not supported by ${provider.label}.`);

  const key = crypto.createHash("sha256").update(`${req.requestId}|${req.kind}|${req.sceneId ?? ""}|${req.characterId ?? ""}`).digest("hex");
  const existing = db().prepare("SELECT * FROM generations WHERE idempotency_key = ?").get(key) as GenRow | undefined;
  if (existing) return { generation: toGenView(existing as never), reused: true };

  // One active paid job per scene/character target at a time → no accidental duplicate spend.
  if (provider.paid) {
    const target = req.sceneId ? ["scene_id", req.sceneId] : req.characterId ? ["character_id", req.characterId] : null;
    if (target) {
      const active = db()
        .prepare(`SELECT id FROM generations WHERE ${target[0]} = ? AND kind = ? AND is_paid = 1 AND status IN ('queued','submitting','submitted','generating','unknown')`)
        .get(target[1], req.kind);
      if (active) throw new ConflictError("A paid generation for this item is already in progress. Wait for it or cancel it first.");
    }
  }

  const s = getSettings();
  const estimate = provider.paid ? round2(provider.estimate(s, req.model, req.params)) : 0;
  const project = req.projectId ? getProject(req.projectId) : null;
  if (req.projectId && !project) throw new NotFoundError("Project not found");
  if (provider.paid) {
    const budget = checkBudget({ projectId: req.projectId, sceneId: req.sceneId, estimate, projectBudget: project?.budgetUsd });
    const details = { estimate, budget, provider: provider.label, model: req.model, blocked: !budget.ok };
    if (!budget.ok) throw new PaymentRequiredError(budget.reasons.join(" "), details);
    if (!req.confirmCost || req.estimate === undefined || Math.abs(req.estimate - estimate) > 1e-6) {
      throw new PaymentRequiredError(`This ${req.kind} costs about $${estimate.toFixed(2)}. Explicit confirmation is required.`, details);
    }
  }

  const id = newId("g_");
  const t = now();
  db()
    .prepare(
      `INSERT INTO generations(id,project_id,scene_id,character_id,kind,provider,model,prompt,params_json,status,idempotency_key,estimated_cost,is_paid,is_demo,approved_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'queued',?,?,?,?,?,?,?)`,
    )
    .run(id, req.projectId ?? null, req.sceneId ?? null, req.characterId ?? null, req.kind, provider.id, req.model, req.prompt, JSON.stringify(req.params), key, estimate, provider.paid ? 1 : 0, provider.demo ? 1 : 0, provider.paid ? t : null, t, t);
  if (provider.paid) ledger({ projectId: req.projectId, generationId: id, provider: provider.id, kind: req.kind, estimated: estimate, note: "approved by user" });
  enqueue("generation.submit", { generationId: id }, req.projectId);
  return { generation: getGeneration(id)!, reused: false };
}

/** Background: submit exactly once. */
async function submitGeneration(id: string) {
  const r = row(id);
  if (!r || r.status !== "queued") return; // already submitted, cancelled or failed — never resubmit
  setGen(id, { status: "submitting", submitted_at: now() });
  const provider = getProvider(r.provider);
  const gen = toRecord(r);
  const params = { ...gen.params };
  if (provider.paid && provider.balanceUsd) {
    const others = db().prepare("SELECT COUNT(*) AS n FROM generations WHERE provider = ? AND id != ? AND status IN ('submitting','submitted','generating','unknown')").get(r.provider, id) as { n: number };
    if (others.n === 0) {
      const bal = await provider.balanceUsd();
      if (bal !== null) params._balanceBefore = bal;
    }
    setGen(id, { params_json: JSON.stringify(params) });
  }
  try {
    const res = await provider.submit({ ...gen, submittedAt: now() });
    if ("output" in res) {
      await finishWithFile(id, res.output.file, res.output.remoteUrl ?? null, res.output.meta ?? {});
    } else {
      setGen(id, { status: "submitted", provider_job_id: res.providerJobId, next_poll_at: now() + 5000, error: null });
    }
  } catch (e) {
    if (e instanceof UnknownOutcomeError) {
      const how = provider.reconcile
        ? "Checking with the provider"
        : "This provider has no documented way to look the request up, so check your provider dashboard";
      setGen(id, { status: "unknown", error: `${redact(e)} ${how} — it will NOT be resubmitted automatically. Dismiss it once you've confirmed, then retry manually if needed.`, next_poll_at: provider.reconcile ? now() + 15_000 : now() + 365 * 24 * 3600_000 });
    } else {
      setGen(id, { status: "failed", error: redact(e) });
      if (r.is_paid) ledger({ projectId: r.project_id, generationId: id, provider: r.provider, kind: r.kind, estimated: r.estimated_cost, actual: 0, note: "submission rejected — not charged" });
    }
  }
}

async function finishWithFile(id: string, file: string, remoteUrl: string | null, meta: Record<string, unknown>) {
  const r = row(id)!;
  if (r.kind === "video") {
    const info = await probe(file).catch((e) => {
      throw new ProviderError(`Generated clip is unreadable: ${(e as Error).message}`);
    });
    if (!info.hasVideo || info.durationSec < 0.5) throw new ProviderError("Generated clip has no usable video stream.");
    meta = { ...meta, width: info.width, height: info.height, fps: info.fps, durationSec: info.durationSec };
  }
  const isRef = !!r.character_id && !r.scene_id;
  const asset = createAsset({
    projectId: r.project_id,
    sceneId: r.scene_id,
    characterId: r.character_id,
    kind: r.kind === "video" ? "clip" : isRef ? "reference" : "storyboard",
    path: toRel(file),
    remoteUrl,
    provider: r.provider,
    model: r.model,
    isDemo: !!r.is_demo,
    meta: { ...meta, generationId: id, prompt: r.prompt, mode: parseJson<Record<string, unknown>>(r.params_json, {}).mode },
  });
  setGen(id, { status: "completed", asset_id: asset.id, completed_at: now(), error: null });
  // A new take becomes the scene's current storyboard/clip; clips need fresh approval.
  if (r.scene_id && getScene(r.scene_id)) {
    if (r.kind === "video") setSceneFields(r.scene_id, { clipAssetId: asset.id, approval: "pending" });
    else setSceneFields(r.scene_id, { storyboardAssetId: asset.id });
  }
  return asset;
}

const MAX_WAIT_MS = 3 * 60 * 60 * 1000;

/** Background poller: advance submitted/generating jobs and reconcile unknown submissions. */
export async function pollGenerations() {
  const due = db()
    .prepare("SELECT * FROM generations WHERE status IN ('submitted','generating','unknown') AND (next_poll_at IS NULL OR next_poll_at <= ?) ORDER BY next_poll_at LIMIT 10")
    .all(now()) as GenRow[];
  for (const r of due) await pollOne(r).catch((e) => log.error(`poll ${r.id}`, redact(e)));
}

async function pollOne(r: GenRow) {
  const provider = getProvider(r.provider);
  const gen = toRecord(r);
  const backoff = Math.min(30_000, 5000 * Math.pow(1.3, r.poll_count));
  if (r.status === "unknown") {
    if (!provider.reconcile || r.provider_job_id) return;
    const found = await provider.reconcile(gen).catch(() => null);
    if (found) {
      setGen(r.id, { status: "submitted", provider_job_id: found, error: null, next_poll_at: now() + 3000, poll_count: 0 });
    } else if (r.poll_count >= 8) {
      setGen(r.id, { error: "Could not confirm whether the provider received this request. It was NOT resubmitted. Check your provider dashboard, then dismiss or retry manually.", next_poll_at: now() + 24 * 3600_000 });
    } else {
      setGen(r.id, { poll_count: r.poll_count + 1, next_poll_at: now() + 30_000 });
    }
    return;
  }
  if (!provider.poll || !r.provider_job_id) return;
  if (now() - (r.submitted_at ?? r.created_at) > MAX_WAIT_MS) {
    setGen(r.id, { status: "unknown", error: "The provider has not finished after 3 hours. Not resubmitted; check the provider dashboard.", next_poll_at: now() + 24 * 3600_000 });
    return;
  }
  let res;
  try {
    res = await provider.poll(gen);
  } catch (e) {
    setGen(r.id, { poll_count: r.poll_count + 1, next_poll_at: now() + backoff, error: `Status check failed (will retry checking, not resubmit): ${redact(e)}` });
    return;
  }
  if (res.state === "queued" || res.state === "generating") {
    setGen(r.id, { status: res.state === "queued" ? "submitted" : "generating", poll_count: r.poll_count + 1, next_poll_at: now() + backoff, error: null });
    return;
  }
  if (res.state === "failed") {
    setGen(r.id, { status: "failed", error: res.error ?? "Generation failed." });
    await measureActual(r.id);
    return;
  }
  // completed → download
  try {
    const dir = r.project_id ? mediaDir("projects", r.project_id, r.kind === "video" ? "clips" : "storyboards") : mediaDir("characters", r.character_id ?? "misc", "references");
    const dest = uniqueFile(dir, extFor(r.kind, res.outputUrl!), r.provider);
    await provider.download!(res.outputUrl!, dest);
    await finishWithFile(r.id, dest, res.outputUrl!, {});
    await measureActual(r.id);
  } catch (e) {
    setGen(r.id, { status: "failed", error: `Generated successfully but the result could not be saved: ${redact(e)}` });
  }
}

/** Actual cost = provider balance drop, only when this was the only paid job in flight. */
async function measureActual(id: string) {
  const r = row(id)!;
  const before = parseJson<{ _balanceBefore?: number }>(r.params_json, {})._balanceBefore;
  const provider = getProvider(r.provider);
  if (before === undefined || !provider.balanceUsd) return;
  const others = db().prepare("SELECT COUNT(*) AS n FROM generations WHERE provider = ? AND id != ? AND status IN ('submitting','submitted','generating')").get(r.provider, id) as { n: number };
  if (others.n > 0) return;
  const after = await provider.balanceUsd();
  if (after === null) return;
  const actual = round2(Math.max(0, before - after));
  setGen(id, { actual_cost: actual });
  ledger({ projectId: r.project_id, generationId: id, provider: r.provider, kind: r.kind, estimated: r.estimated_cost, actual, note: "measured from provider balance" });
}

export async function cancelGeneration(id: string): Promise<GenerationView> {
  const r = row(id);
  if (!r) throw new NotFoundError("Generation not found");
  if (r.status === "queued" || r.status === "awaiting_approval") {
    setGen(id, { status: "cancelled", error: "Cancelled before submission — nothing was charged." });
  } else if (["submitted", "generating", "submitting"].includes(r.status)) {
    const provider = getProvider(r.provider);
    let note = "Cancelled.";
    if (provider.cancel && r.provider_job_id) {
      try {
        await provider.cancel(toRecord(r));
        note = "Cancelled and deleted at the provider. Work already started may still be billed by the provider.";
      } catch (e) {
        note = `Stopped tracking, but the provider cancel call failed: ${redact(e)}. It may still complete and bill.`;
      }
    }
    setGen(id, { status: "cancelled", error: note });
  } else if (r.status === "unknown") {
    setGen(id, { status: "failed", provider_job_id: null, error: "Dismissed by user (submission was never confirmed)." });
  } else throw new ValidationError(`A ${r.status} generation cannot be cancelled.`);
  return getGeneration(id)!;
}

export function listGenerations(f: { projectId?: string; sceneId?: string; characterId?: string; status?: string; limit?: number }) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.projectId) (where.push("project_id = ?"), args.push(f.projectId));
  if (f.sceneId) (where.push("scene_id = ?"), args.push(f.sceneId));
  if (f.characterId) (where.push("character_id = ?"), args.push(f.characterId));
  if (f.status) (where.push("status = ?"), args.push(f.status));
  return (db().prepare(`SELECT * FROM generations ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`).all(...args, f.limit ?? 100) as GenRow[]).map((r) => toGenView(r as never));
}

/** For tests: run the submit step directly. */
export const _test = { submitGeneration, pollOne: (id: string) => pollOne(row(id)!), row };

export function registerGenerationHandlers() {
  registerHandler("generation.submit", async (ctx) => {
    const id = String(ctx.job.payload.generationId);
    ctx.progress(0.2, "Submitting…");
    await submitGeneration(id);
    const g = getGeneration(id);
    if (g?.status === "failed") throw new Error(g.error ?? "Generation failed");
    return { status: g?.status };
  });
  registerPoller(pollGenerations);
}

/** Webhook from the provider (optional; polling works without it). Only advances state via a fresh status fetch. */
export async function nudgeByProviderJobId(providerJobId: string) {
  const r = db().prepare("SELECT * FROM generations WHERE provider_job_id = ? AND status IN ('submitted','generating')").get(providerJobId) as GenRow | undefined;
  if (r) await pollOne(r);
}

export function cleanupPartialFiles(file: string) {
  try {
    fs.rmSync(`${file}.part`, { force: true });
  } catch {}
}
