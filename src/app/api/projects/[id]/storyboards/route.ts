import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { sketchAllStoryboards } from "@/lib/features/visuals";
import { requireProject } from "@/lib/repo";

/** Free: sketch storyboards for every scene missing one (or all scenes). */
export const POST = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const { all } = z.object({ all: z.boolean().default(false) }).parse(await readJson(req));
  return { generations: sketchAllStoryboards(id, all) };
});
