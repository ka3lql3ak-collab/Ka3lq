import { route } from "@/lib/api";
import { getJob } from "@/lib/jobs";
import { NotFoundError } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const job = getJob(id);
  if (!job) throw new NotFoundError("Job not found");
  return { job };
});
