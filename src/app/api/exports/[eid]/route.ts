import { route } from "@/lib/api";
import { deleteExport } from "@/lib/exports";

export const DELETE = route<{ eid: string }>(async (_req, { eid }) => {
  deleteExport(eid);
  return { ok: true };
});
