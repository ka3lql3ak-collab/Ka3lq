import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { getEditorOptions, saveEditorOptions } from "@/lib/features/voice";
import { listAssets, requireProject } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  requireProject(id);
  return { options: getEditorOptions(id), music: listAssets({ projectId: id, kind: "music" }) };
});

const Schema = z.object({
  music: z.enum(["none", "generated", "upload"]).optional(),
  mood: z.enum(["auto", "major", "playful", "minor", "mystery"]).optional(),
  musicAssetId: z.string().nullable().optional(),
  musicLicenseConfirmed: z.boolean().optional(),
  captions: z.enum(["speech", "captions", "off"]).optional(),
  includeUnapproved: z.boolean().optional(),
});

export const PUT = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  return { options: saveEditorOptions(id, Schema.parse(await readJson(req))) };
});
