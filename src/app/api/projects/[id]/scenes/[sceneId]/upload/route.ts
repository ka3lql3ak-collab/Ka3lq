import { route } from "@/lib/api";
import { createAsset, requireProject, requireScene, setSceneFields, ValidationError } from "@/lib/repo";
import { mediaDir, toRel } from "@/lib/paths";
import { saveUpload } from "@/lib/uploads";

/** Import your own clip (e.g. made in a free web app) or keyframe image for a scene. */
export const POST = route<{ id: string; sceneId: string }>(async (req, { id, sceneId }) => {
  requireProject(id);
  requireScene(sceneId, id);
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  if (kind !== "clip" && kind !== "storyboard") throw new ValidationError("kind must be clip or storyboard");
  const { abs, info } = await saveUpload(form.get("file") as File, kind === "clip" ? "video" : "image", mediaDir("projects", id, kind === "clip" ? "clips" : "storyboards"));
  const asset = createAsset({
    projectId: id,
    sceneId,
    kind,
    path: toRel(abs),
    provider: "upload",
    meta: { width: info.width, height: info.height, durationSec: info.durationSec, fps: info.fps, originalName: String((form.get("file") as File).name).slice(0, 120) },
  });
  if (kind === "clip") setSceneFields(sceneId, { clipAssetId: asset.id, approval: "pending" });
  else setSceneFields(sceneId, { storyboardAssetId: asset.id });
  return { asset };
});
