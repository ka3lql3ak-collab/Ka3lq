import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { deleteScene, requireProject, requireScene, setSceneFields, updateProject, updateSceneData, ValidationError } from "@/lib/repo";
import { StorySceneSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  data: StorySceneSchema.partial().optional(),
  approval: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const PATCH = route<{ id: string; sceneId: string }>(async (req, { id, sceneId }) => {
  requireProject(id);
  const scene = requireScene(sceneId, id);
  const body = PatchSchema.parse(await readJson(req));
  if (body.data && Object.keys(body.data).length) {
    updateSceneData(sceneId, body.data);
    // Script-affecting edits unlock script approval so changes are re-reviewed.
    const scriptKeys = ["visual", "dialogue", "narration", "characters", "durationSec", "camera", "action"];
    if (Object.keys(body.data).some((k) => scriptKeys.includes(k))) updateProject(id, { scriptApproved: false });
  }
  if (body.approval) {
    if (body.approval === "approved" && !scene.clipAssetId) throw new ValidationError("Generate (or import) a video clip for this scene before approving it.");
    setSceneFields(sceneId, { approval: body.approval });
  }
  return { scene: requireScene(sceneId) };
});

export const DELETE = route<{ id: string; sceneId: string }>(async (_req, { id, sceneId }) => {
  requireProject(id);
  requireScene(sceneId, id);
  deleteScene(sceneId);
  updateProject(id, { scriptApproved: false });
  return { ok: true };
});
