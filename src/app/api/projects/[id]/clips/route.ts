import { route } from "@/lib/api";
import { demoAllClips } from "@/lib/features/visuals";
import { requireProject } from "@/lib/repo";
import { listGenerations } from "@/lib/generations";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { generations: listGenerations({ projectId: id, limit: 200 }) };
});

/** Demo mode only: placeholder clips for every scene without one (free, watermarked). */
export const POST = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { generations: demoAllClips(id) };
});
