import { route, readJson } from "@/lib/api";
import { deleteProject, listScenes, projectCharacters, requireProject, updateProject } from "@/lib/repo";
import { summarize } from "@/lib/summary";
import { StorySettingsSchema } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const project = requireProject(id);
  return { project, summary: summarize(project), scenes: listScenes(id), characters: projectCharacters(id) };
});

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional(),
  budgetUsd: z.number().min(0).max(10000).nullable().optional(),
  settings: StorySettingsSchema.optional(),
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const patch = PatchSchema.parse(await readJson(req));
  return { project: updateProject(id, patch) };
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  deleteProject(id);
  return { ok: true };
});
