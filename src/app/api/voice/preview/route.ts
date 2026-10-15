import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { previewVoice } from "@/lib/features/voice";
import { mediaUrl } from "@/lib/paths";
import { VoiceConfigSchema } from "@/lib/types";

export const POST = route(async (req) => {
  const b = z.object({ voice: VoiceConfigSchema, text: z.string().trim().min(1).max(200) }).parse(await readJson(req));
  return { url: mediaUrl(await previewVoice(b.voice, b.text)) };
});
