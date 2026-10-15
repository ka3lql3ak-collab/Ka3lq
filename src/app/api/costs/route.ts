import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { committedSpend } from "@/lib/costs";
import { listGenerations } from "@/lib/generations";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const ledger = db().prepare("SELECT l.*, p.title AS project_title FROM cost_ledger l LEFT JOIN projects p ON p.id = l.project_id ORDER BY l.created_at DESC LIMIT 200").all();
  const byProvider = db()
    .prepare(
      "SELECT provider, COUNT(*) AS n, COALESCE(SUM(COALESCE(actual_cost, estimated_cost)),0) AS total FROM generations WHERE is_paid=1 AND status NOT IN ('awaiting_approval','cancelled') AND NOT (status='failed' AND provider_job_id IS NULL) GROUP BY provider",
    )
    .all();
  return {
    month: committedSpend({ sinceMs: monthStart.getTime() }),
    allTime: committedSpend({}),
    byProvider,
    ledger,
    paid: listGenerations({ limit: 100 }).filter((g) => g.isPaid),
  };
});
