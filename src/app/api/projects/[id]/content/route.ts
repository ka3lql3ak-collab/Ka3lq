import { route, readJson } from "@/lib/api";
import { requireProject, updateProject, listScenes, ValidationError } from "@/lib/repo";
import { ShortsContentSchema } from "@/lib/types";
import { shortsContent } from "@/lib/story";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => ({ content: requireProject(id).content }));

export const PUT = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  return { project: updateProject(id, { content: ShortsContentSchema.parse(await readJson(req)) }) };
});

/** Rebuild suggestions from the current (edited) scenes. Free and local. */
export const POST = route<{ id: string }>(async (_req, { id }) => {
  const p = requireProject(id);
  if (!p.story) throw new ValidationError("Write a story first.");
  const scenes = listScenes(id);
  const story = { ...p.story, scenes: scenes.map(({ id: _i, projectId: _p, idx: _x, storyboardAssetId: _s, clipAssetId: _c, approval: _a, ...rest }) => rest) };
  return { project: updateProject(id, { content: shortsContent(story, p.settings) }) };
});
