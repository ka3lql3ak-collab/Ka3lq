import { route } from "@/lib/api";
import { listGenerations } from "@/lib/generations";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const u = new URL(req.url);
  return { generations: listGenerations({ projectId: u.searchParams.get("projectId") ?? undefined, status: u.searchParams.get("status") ?? undefined, limit: 200 }) };
});
