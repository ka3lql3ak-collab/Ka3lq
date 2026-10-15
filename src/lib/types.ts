import { z } from "zod";

/* ----------------------------- Story settings ----------------------------- */

export const GENRES = ["funny", "emotional", "wholesome", "adventure", "mystery", "twist"] as const;
export const DURATIONS = [15, 30, 45, 60] as const;
export const DIALOGUE_STYLES = ["minimal", "playful", "heartfelt", "witty", "no-dialogue"] as const;
export const NARRATOR_STYLES = ["none", "warm storyteller", "playful", "documentary", "dramatic trailer"] as const;
export const VISUAL_STYLES = ["3d family film", "claymation", "storybook 3d", "glossy toy"] as const;

export const StorySettingsSchema = z.object({
  idea: z.string().trim().min(8, "Describe your idea in at least a few words").max(600),
  genre: z.enum(GENRES).default("wholesome"),
  durationSec: z.coerce.number().refine((n) => (DURATIONS as readonly number[]).includes(n), "Duration must be 15, 30, 45 or 60").default(30),
  sceneCount: z.coerce.number().int().min(2).max(12).default(5),
  characterCount: z.coerce.number().int().min(1).max(4).default(2),
  dialogueStyle: z.enum(DIALOGUE_STYLES).default("playful"),
  narratorStyle: z.enum(NARRATOR_STYLES).default("warm storyteller"),
  visualStyle: z.enum(VISUAL_STYLES).default("3d family film"),
  language: z.string().trim().min(2).max(40).default("English"),
  storyProvider: z.enum(["local", "anthropic", "openai-compat"]).default("local"),
});
export type StorySettings = z.infer<typeof StorySettingsSchema>;

/* ---------------------------------- Story --------------------------------- */

export const BEATS = ["hook", "setup", "conflict", "turn", "payoff", "button"] as const;

export const DialogueLineSchema = z.object({
  speaker: z.string().trim().min(1).max(60), // character name or "Narrator"
  text: z.string().trim().min(1).max(300),
});
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const StoryCharacterSchema = z.object({
  name: z.string().trim().min(1).max(40),
  fruit: z.string().trim().min(1).max(40),
  appearance: z.string().trim().max(600).default(""),
  personality: z.string().trim().max(300).default(""),
  voiceHint: z.string().trim().max(120).default(""),
});
export type StoryCharacter = z.infer<typeof StoryCharacterSchema>;

export const StorySceneSchema = z.object({
  beat: z.enum(BEATS).catch("setup"),
  durationSec: z.coerce.number().min(2).max(10),
  visual: z.string().trim().min(1).max(1200),
  camera: z.string().trim().max(300).default(""),
  characters: z.array(z.string().trim().min(1)).max(4).default([]),
  action: z.string().trim().max(400).default(""),
  emotion: z.string().trim().max(120).default(""),
  dialogue: z.array(DialogueLineSchema).max(6).default([]),
  narration: z.string().trim().max(400).default(""),
  sfx: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
  caption: z.string().trim().max(160).default(""),
});
export type StoryScene = z.infer<typeof StorySceneSchema>;

export const StorySchema = z.object({
  title: z.string().trim().min(1).max(120),
  logline: z.string().trim().max(400).default(""),
  hook: z.string().trim().max(200).default(""),
  characters: z.array(StoryCharacterSchema).min(1).max(4),
  scenes: z.array(StorySceneSchema).min(2).max(12),
  description: z.string().trim().max(1000).default(""),
});
export type Story = z.infer<typeof StorySchema>;

/* ----------------------------- Shorts metadata ---------------------------- */

export const ShortsContentSchema = z.object({
  hooks: z.array(z.string()).length(3),
  titles: z.array(z.string()).length(3),
  description: z.string(),
  hashtags: z.array(z.string()),
  pinnedComment: z.string(),
  coverSuggestions: z.array(z.object({ sceneIndex: z.number(), reason: z.string(), atSec: z.number() })),
});
export type ShortsContent = z.infer<typeof ShortsContentSchema>;

/* -------------------------------- Characters ------------------------------ */

export const VoiceConfigSchema = z.object({
  engine: z.enum(["flite", "piper", "recorded"]).default("flite"),
  voice: z.string().max(120).default("slt"),
  pitch: z.coerce.number().min(0.5).max(2).default(1.2), // 1 = unchanged
  speed: z.coerce.number().min(0.5).max(2).default(1.0),
  volume: z.coerce.number().min(0).max(2).default(1.0),
});
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

export const CharacterInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  fruit: z.string().trim().min(1).max(40),
  appearance: z.string().trim().max(800).default(""),
  bodyShape: z.string().trim().max(300).default(""),
  face: z.string().trim().max(300).default(""),
  eyes: z.string().trim().max(300).default(""),
  mouth: z.string().trim().max(300).default(""),
  limbs: z.string().trim().max(300).default(""),
  clothing: z.string().trim().max(300).default(""),
  accessories: z.string().trim().max(300).default(""),
  personality: z.string().trim().max(400).default(""),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(4).default(["#e8384f", "#3fa34d"]),
  voice: VoiceConfigSchema.default({ engine: "flite", voice: "slt", pitch: 1.2, speed: 1, volume: 1 }),
});
export type CharacterInput = z.infer<typeof CharacterInputSchema>;

/* ----------------------------- Status enums ------------------------------- */

export type ApprovalState = "pending" | "approved" | "rejected";
export type GenerationStatus =
  | "awaiting_approval"
  | "queued"
  | "submitting"
  | "submitted"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
