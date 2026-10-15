import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { createExport, listExports } from "@/lib/exports";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => ({ exports: listExports({ projectId: id }) }));

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { renderId } = z.object({ renderId: z.string() }).parse(await readJson(req));
  return { export: createExport(id, renderId) };
});
