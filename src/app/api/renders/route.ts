import { route } from "@/lib/api";
import { listRenders } from "@/lib/render";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const titles = new Map((db().prepare("SELECT id, title FROM projects").all() as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  return { renders: listRenders({ limit: 100 }).map((r) => ({ ...r, projectTitle: titles.get(r.projectId) ?? "(deleted project)" })) };
});
