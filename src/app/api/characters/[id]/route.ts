import { route, readJson } from "@/lib/api";
import { deleteCharacter, listAssets, requireCharacter, updateCharacter } from "@/lib/repo";
import { CharacterInputSchema } from "@/lib/types";
import { listGenerations } from "@/lib/generations";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const character = requireCharacter(id);
  const projects = db().prepare("SELECT p.id, p.title FROM projects p JOIN project_characters pc ON pc.project_id = p.id WHERE pc.character_id = ?").all(id);
  return { character, images: listAssets({ characterId: id, kind: "reference" }), generations: listGenerations({ characterId: id, limit: 20 }), projects };
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  requireCharacter(id);
  return { character: updateCharacter(id, CharacterInputSchema.partial().parse(await readJson(req))) };
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  requireCharacter(id);
  deleteCharacter(id);
  return { ok: true };
});
