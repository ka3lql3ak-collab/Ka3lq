import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { getAsset, listAssets, requireProject, requireScene, setSceneFields, ValidationError } from "@/lib/repo";
import { listGenerations } from "@/lib/generations";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string; sceneId: string }>(async (_req, { id, sceneId }) => {
  requireProject(id);
  requireScene(sceneId, id);
  return { clips: listAssets({ sceneId, kind: "clip" }), storyboards: listAssets({ sceneId, kind: "storyboard" }), generations: listGenerations({ sceneId, limit: 30 }) };
});

const Schema = z.object({ assetId: z.string() });

/** Choose which take (clip or storyboard) the scene uses. */
export const POST = route<{ id: string; sceneId: string }>(async (req, { id, sceneId }) => {
  requireProject(id);
  requireScene(sceneId, id);
  const { assetId } = Schema.parse(await readJson(req));
  const a = getAsset(assetId);
  if (!a || a.sceneId !== sceneId) throw new ValidationError("That take does not belong to this scene.");
  if (a.kind === "clip") setSceneFields(sceneId, { clipAssetId: a.id, approval: "pending" });
  else if (a.kind === "storyboard") setSceneFields(sceneId, { storyboardAssetId: a.id });
  else throw new ValidationError("Only clips and storyboards can be selected.");
  return { ok: true };
});
