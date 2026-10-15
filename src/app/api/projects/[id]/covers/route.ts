import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { extractCovers } from "@/lib/render";
import { listAssets, requireProject } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { covers: listAssets({ projectId: id, kind: "cover" }) };
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const p = requireProject(id);
  const { renderId } = z.object({ renderId: z.string() }).parse(await readJson(req));
  const times = p.content?.coverSuggestions.map((c) => c.atSec) ?? [1];
  return { covers: await extractCovers(id, renderId, times) };
});
