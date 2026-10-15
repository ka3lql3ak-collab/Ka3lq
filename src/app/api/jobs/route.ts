import { route } from "@/lib/api";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const u = new URL(req.url);
  return { jobs: listJobs({ projectId: u.searchParams.get("projectId") ?? undefined, status: u.searchParams.get("status") ?? undefined, limit: 200 }) };
});
