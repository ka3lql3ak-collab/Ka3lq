import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { addScene, listScenes, requireProject, updateProject } from "@/lib/repo";
import { StorySceneSchema } from "@/lib/types";
import { sceneViews } from "@/lib/features/scene-view";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { scenes: sceneViews(id) };
});

const AddSchema = z.object({ scene: StorySceneSchema.partial().optional(), atIndex: z.number().int().min(0).optional() });

export const POST = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const body = AddSchema.parse(await readJson(req));
  const scene = addScene(id, StorySceneSchema.parse({ beat: "setup", durationSec: 4, visual: "Describe what happens in this shot.", ...body.scene }), body.atIndex);
  updateProject(id, { scriptApproved: false });
  return { scene, count: listScenes(id).length };
});
