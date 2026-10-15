import { route } from "@/lib/api";
import { capabilities, getSettings } from "@/lib/settings";
import { keyframeProviderFor, getProvider } from "@/lib/providers/registry";
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
  const s = getSettings();
  const kf = keyframeProviderFor(s);
  const preferredVideo = s.video.provider === "higgsfield" ? getProvider("higgsfield-video") : s.video.provider === "luma" ? getProvider("luma-video") : null;
  return {
    capabilities: caps,
    tools,
    counts,
    monthSpend: committedSpend({ sinceMs: monthStart.getTime() }),
    providers: {
      video: { preferred: s.video.provider, label: preferredVideo?.label ?? "Manual import", configured: preferredVideo?.configured() ?? { ok: false, reason: "Manual mode" } },
      keyframe: kf ? { id: kf.id, label: kf.label } : null,
    },
  };
});
