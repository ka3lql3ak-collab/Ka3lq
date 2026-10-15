import { route } from "@/lib/api";
import { capabilities } from "@/lib/settings";
import { detectTools } from "@/lib/media/ffmpeg";
import { db } from "@/lib/db";
import { committedSpend } from "@/lib/costs";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const tools = await detectTools();
  const caps = capabilities(tools);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const counts = db()
    .prepare(
      `SELECT (SELECT COUNT(*) FROM projects WHERE archived=0) AS projects,
              (SELECT COUNT(*) FROM characters) AS characters,
              (SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')) AS activeJobs,
              (SELECT COUNT(*) FROM generations WHERE status IN ('submitted','generating','submitting','queued')) AS activeGenerations,
              (SELECT COUNT(*) FROM exports) AS exports`,
    )
    .get();
  return { capabilities: caps, tools, counts, monthSpend: committedSpend({ sinceMs: monthStart.getTime() }) };
});
