import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config } from "../config";
import { BEATS, type StorySettings } from "../types";
import { SFX_NAMES } from "../media/sfx-names";

/** Plain schema for model output (no numeric bounds); normalised + strictly validated afterwards. */
export const LlmStorySchema = z.object({
  title: z.string(),
  logline: z.string(),
  hook: z.string(),
  description: z.string(),
  characters: z.array(z.object({ name: z.string(), fruit: z.string(), appearance: z.string(), personality: z.string(), voiceHint: z.string() })),
  scenes: z.array(
    z.object({
      beat: z.enum(BEATS),
      durationSec: z.number(),
      visual: z.string(),
      camera: z.string(),
      characters: z.array(z.string()),
      action: z.string(),
      emotion: z.string(),
      dialogue: z.array(z.object({ speaker: z.string(), text: z.string() })),
      narration: z.string(),
      sfx: z.array(z.string()),
      caption: z.string(),
    }),
  ),
});
export type LlmStory = z.infer<typeof LlmStorySchema>;

export interface ExistingCharacter {
  name: string;
  fruit: string;
  appearance: string;
  personality: string;
}

export function buildStoryPrompt(s: StorySettings, existing: ExistingCharacter[], variation: number) {
  const system = `You are an award-winning writer and storyboard artist for short-form 3D animated family films, writing original YouTube Shorts starring adorable fruit characters.
Write stories that are instantly clear on a phone with the sound off: a scroll-stopping visual hook in the first 1-2 seconds, a clear conflict, and an emotional or funny payoff. No exposition dumps.
Each scene becomes ONE AI-generated video clip, so each scene must be a single continuous shot that a video model can render: one location, one main action, simple physical motion, no on-screen text or signs, no complex choreography, at most 3 characters in frame.
Visual descriptions are always in English (they are prompts for a video model) and must describe the characters by name and appearance, the setting, lighting and the motion. Dialogue, narration and captions are written in ${s.language}.`;
  const user = `Story idea: "${s.idea}"
Genre: ${s.genre}. Total length: exactly ${s.durationSec} seconds across exactly ${s.sceneCount} scenes (each scene 2-9 seconds; durations must add up to ${s.durationSec}).
Characters: ${s.characterCount}. Dialogue style: ${s.dialogueStyle}${s.dialogueStyle === "no-dialogue" ? " (leave every dialogue array empty)" : " (short, natural lines; at most 2 lines per scene, under 12 words each)"}.
Narrator: ${s.narratorStyle}${s.narratorStyle === "none" ? " (leave narration empty)" : " (one short sentence at most per scene, only where it helps)"}.
Visual style: ${s.visualStyle} — cinematic, soft shadows, natural lighting, appealing colors, shallow depth of field.
${existing.length ? `Reuse these existing characters exactly (same names, fruit and look):\n${existing.map((c) => `- ${c.name} (${c.fruit}): ${c.appearance} Personality: ${c.personality}`).join("\n")}` : "Invent cute, memorable names for the fruit characters."}
Beats: the first scene's beat is "hook" and the last is "payoff" or "button". Use beats from: ${BEATS.join(", ")}.
Camera: give a specific camera angle and movement per scene.
Sound effects: choose 0-3 per scene ONLY from: ${SFX_NAMES.join(", ")}.
Captions: max 8 words, no emoji, readable on mobile.
For each character, "appearance" must be a detailed, reusable visual description (body shape, skin texture, eyes, mouth, limbs, clothing/accessories) and "voiceHint" a short voice description.
Variation seed: ${variation} (produce a fresh take if > 0).`;
  return { system, user };
}

export async function anthropicStory(s: StorySettings, existing: ExistingCharacter[], variation: number): Promise<LlmStory> {
  if (!config.anthropic.apiKey) throw new Error("ANTHROPIC_API_KEY is not configured. Add it to .env.local or use the free local composer.");
  const client = new Anthropic({ apiKey: config.anthropic.apiKey, maxRetries: 1, timeout: 120_000 });
  const { system, user } = buildStoryPrompt(s, existing, variation);
  try {
    const res = await client.messages.parse({
      model: config.anthropic.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(LlmStorySchema) },
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined to write this story. Try rephrasing the idea.");
    if (res.stop_reason === "max_tokens") throw new Error("The story response was cut off. Try fewer scenes.");
    if (!res.parsed_output) throw new Error("The model returned a story that did not match the expected format.");
    return res.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Anthropic rate limit reached (429). Wait a minute and try again.");
    if (e instanceof Anthropic.APIError) throw new Error(`Anthropic API error ${e.status ?? ""}: ${e.message}`);
    throw e;
  }
}

/** Any OpenAI-compatible /chat/completions endpoint — e.g. a free local Ollama server. */
export async function openaiCompatStory(s: StorySettings, existing: ExistingCharacter[], variation: number, fetchImpl: typeof fetch = fetch): Promise<LlmStory> {
  const base = config.openaiCompat.baseUrl;
  const model = config.openaiCompat.model;
  if (!base || !model) throw new Error("OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_MODEL must be set (e.g. http://localhost:11434/v1 and llama3.1 for Ollama).");
  const { system, user } = buildStoryPrompt(s, existing, variation);
  const schemaHint = `Respond with ONLY a JSON object with keys: title, logline, hook, description, characters[{name,fruit,appearance,personality,voiceHint}], scenes[{beat,durationSec,visual,camera,characters[],action,emotion,dialogue[{speaker,text}],narration,sfx[],caption}].`;
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(config.openaiCompat.apiKey ? { Authorization: `Bearer ${config.openaiCompat.apiKey}` } : {}) },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${user}\n\n${schemaHint}` },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Story endpoint returned ${res.status}: ${text.slice(0, 300)}`);
  let content: string;
  try {
    content = JSON.parse(text).choices?.[0]?.message?.content ?? "";
  } catch {
    throw new Error("Story endpoint returned a non-JSON response.");
  }
  const json = extractJson(content);
  const parsed = LlmStorySchema.safeParse(json);
  if (!parsed.success) throw new Error(`The model's story JSON was incomplete: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return parsed.data;
}

export function extractJson(s: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object found in the model response.");
  return JSON.parse(body.slice(start, end + 1));
}
