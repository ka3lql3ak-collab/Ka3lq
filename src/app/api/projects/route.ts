import { route, readJson } from "@/lib/api";
import { createProject, listProjects } from "@/lib/repo";
import { StorySettingsSchema } from "@/lib/types";
import { summarize } from "@/lib/summary";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const u = new URL(req.url);
  const projects = listProjects({
    q: u.searchParams.get("q")?.slice(0, 100) || undefined,
    archived: u.searchParams.get("archived") === "1",
  });
  let out = projects.map(summarize);
  const stage = u.searchParams.get("stage");
  if (stage) out = out.filter((p) => p.stage === stage);
  const genre = u.searchParams.get("genre");
  if (genre) out = out.filter((p) => p.genre === genre);
  return { projects: out };
});

const CreateSchema = z.object({ title: z.string().max(120).optional(), settings: StorySettingsSchema });

export const POST = route(async (req) => {
  const body = CreateSchema.parse(await readJson(req));
  const project = createProject(body.settings, body.title);
  return { project };
});
