import { route } from "@/lib/api";
import { enqueue } from "@/lib/jobs";
import { projectVoiceLines } from "@/lib/features/voice";
import { requireProject } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => ({ scenes: projectVoiceLines(id), narrator: getSettings().render.narrator }));

/** Free: synthesize all missing lines locally. */
export const POST = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { job: enqueue("voice.generate", { projectId: id }, id, { dedupeKey: `voice:${id}` }) };
});
