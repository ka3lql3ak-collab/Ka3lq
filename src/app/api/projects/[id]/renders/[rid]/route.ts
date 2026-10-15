import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { setRenderApproval, getRender } from "@/lib/render";
import { NotFoundError } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string; rid: string }>(async (_req, { id, rid }) => {
  const r = getRender(rid);
  if (!r || r.projectId !== id) throw new NotFoundError("Render not found");
  return { render: r };
});

/** Your approval of the edited video (required before export). */
export const PATCH = route<{ id: string; rid: string }>(async (req, { id, rid }) => {
  const { approval } = z.object({ approval: z.enum(["approved", "rejected", "pending"]) }).parse(await readJson(req));
  return { render: setRenderApproval(id, rid, approval) };
});
