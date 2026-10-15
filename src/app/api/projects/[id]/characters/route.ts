import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { linkCharacters, projectCharacters, requireCharacter, requireProject, unlinkCharacter } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { characters: projectCharacters(id) };
});

const Schema = z.object({ characterId: z.string(), action: z.enum(["link", "unlink"]) });

export const POST = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const b = Schema.parse(await readJson(req));
  requireCharacter(b.characterId);
  if (b.action === "link") linkCharacters(id, [b.characterId]);
  else unlinkCharacter(id, b.characterId);
  return { characters: projectCharacters(id) };
});
