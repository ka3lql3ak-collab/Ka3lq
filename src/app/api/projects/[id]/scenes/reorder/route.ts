import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { reorderScenes, requireProject } from "@/lib/repo";

const Schema = z.object({ order: z.array(z.string()).min(1).max(12) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const { order } = Schema.parse(await readJson(req));
  reorderScenes(id, order);
  return { ok: true };
});
