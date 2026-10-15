import "server-only";
import { db, parseJson } from "../db";
import { getAsset, listScenes, type Asset, type Scene } from "../repo";
import { estimateVideoCost } from "../costs";
import { getSettings } from "../settings";
import type { GenerationStatus } from "../types";

export interface GenerationView {
  id: string;
  kind: string;
  provider: string;
  model: string;
  status: GenerationStatus;
  estimatedCost: number;
  actualCost: number | null;
  isPaid: boolean;
  isDemo: boolean;
  error: string | null;
  providerJobId: string | null;
  params: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface GenRow {
  id: string;
  kind: string;
  provider: string;
  model: string;
  status: GenerationStatus;
  estimated_cost: number;
  actual_cost: number | null;
  is_paid: number;
  is_demo: number;
  error: string | null;
  provider_job_id: string | null;
  params_json: string;
  created_at: number;
  updated_at: number;
}

export const toGenView = (r: GenRow): GenerationView => ({
  id: r.id,
  kind: r.kind,
  provider: r.provider,
  model: r.model,
  status: r.status,
  estimatedCost: r.estimated_cost,
  actualCost: r.actual_cost,
  isPaid: !!r.is_paid,
  isDemo: !!r.is_demo,
  error: r.error,
  providerJobId: r.provider_job_id,
  params: parseJson(r.params_json, {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface SceneView extends Scene {
  storyboard: Asset | null;
  clip: Asset | null;
  videoGen: GenerationView | null;
  imageGen: GenerationView | null;
  clipEstimate: number | null;
  startSec: number;
  spent: number;
}

export function latestGen(sceneId: string, kind: string): GenerationView | null {
  const r = db().prepare("SELECT * FROM generations WHERE scene_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1").get(sceneId, kind) as GenRow | undefined;
  return r ? toGenView(r) : null;
}

export function sceneViews(projectId: string): SceneView[] {
  const s = getSettings();
  let estimate: number | null = null;
  try {
    estimate = estimateVideoCost(s, s.video.model, s.video.resolution, s.video.duration === "9s" ? "9s" : "5s");
  } catch {
    estimate = null;
  }
  let t = 0;
  return listScenes(projectId).map((sc) => {
    const view: SceneView = {
      ...sc,
      storyboard: sc.storyboardAssetId ? getAsset(sc.storyboardAssetId) : null,
      clip: sc.clipAssetId ? getAsset(sc.clipAssetId) : null,
      videoGen: latestGen(sc.id, "video"),
      imageGen: latestGen(sc.id, "image"),
      clipEstimate: estimate,
      startSec: t,
      spent: (
        db()
          .prepare("SELECT COALESCE(SUM(COALESCE(actual_cost, estimated_cost)),0) AS n FROM generations WHERE scene_id=? AND is_paid=1 AND status NOT IN ('awaiting_approval','cancelled') AND NOT (status='failed' AND provider_job_id IS NULL)")
          .get(sc.id) as { n: number }
      ).n,
    };
    t += sc.durationSec;
    return view;
  });
}
