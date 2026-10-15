import { route } from "@/lib/api";
import { getRender } from "@/lib/render";
import { cancelJob } from "@/lib/jobs";
import { db, now } from "@/lib/db";
import { NotFoundError } from "@/lib/repo";

export const POST = route<{ id: string; rid: string }>(async (_req, { id, rid }) => {
  const r = getRender(rid);
  if (!r || r.projectId !== id) throw new NotFoundError("Render not found");
  if (r.jobId) cancelJob(r.jobId);
  db().prepare("UPDATE renders SET status='cancelled', error='Cancelled by user', updated_at=? WHERE id=? AND status IN ('queued','running')").run(now(), rid);
  return { render: getRender(rid) };
});
