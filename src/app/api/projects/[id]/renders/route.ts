import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { listRenders, queueRender } from "@/lib/render";
import { requireProject } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { renders: listRenders({ projectId: id }) };
});

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { quality } = z.object({ quality: z.enum(["preview", "final"]) }).parse(await readJson(req));
  return { render: queueRender(id, quality) };
});
