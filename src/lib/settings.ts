import "server-only";
import { z } from "zod";
import { db } from "./db";
import { config } from "./config";

/**
 * Prices are ESTIMATES, editable in Settings. Luma's pricing page could not be
 * verified while this was built, so defaults are deliberately conservative
 * (rounded up). Actual spend is measured from Luma's /credits balance when possible.
 */
export const DEFAULT_PRICES = {
  video: {
    "ray-2": { "540p": 0.5, "720p": 0.9, "1080p": 2.0, "4k": 8.0 },
    "ray-flash-2": { "540p": 0.2, "720p": 0.35, "1080p": 0.75, "4k": 3.0 },
  } as Record<string, Record<string, number>>, // USD per 5-second clip
  ninesMultiplier: 1.8, // 9s clip price = 5s price * multiplier
  image: { "photon-1": 0.02, "photon-flash-1": 0.006 } as Record<string, number>,
  /** Higgsfield Cloud API — UNVERIFIED placeholders (docs unreachable at build time). Edit to match your dashboard. */
  higgsfield: {
    video: { "dop-lite": 0.3, "dop-turbo": 0.5, "dop-standard": 0.8 } as Record<string, number>, // USD per generation
    image: { "720p": 0.05, "1080p": 0.1 } as Record<string, number>, // USD per Soul image
  },
  storyLlm: 0.25, // per story estimate for a paid LLM (Anthropic); Ollama/local are free
};

export const SettingsSchema = z.object({
  budget: z.object({
    perSceneUsd: z.coerce.number().min(0).max(1000),
    perProjectUsd: z.coerce.number().min(0).max(10000),
    monthlyUsd: z.coerce.number().min(0).max(100000),
  }),
  prices: z.object({
    video: z.record(z.string(), z.record(z.string(), z.coerce.number().min(0))),
    ninesMultiplier: z.coerce.number().min(1).max(5),
    image: z.record(z.string(), z.coerce.number().min(0)),
    storyLlm: z.coerce.number().min(0),
    higgsfield: z.object({
      video: z.record(z.string(), z.coerce.number().min(0)),
      image: z.record(z.string(), z.coerce.number().min(0)),
    }),
  }),
  video: z.object({
    /** Preferred video provider. Never switched silently: if it isn't configured, generation is blocked or demo-only. */
    provider: z.enum(["higgsfield", "luma", "manual"]),
    higgsfieldModel: z.enum(["dop-lite", "dop-turbo", "dop-standard"]),
    model: z.enum(["ray-2", "ray-flash-2"]),
    resolution: z.enum(["540p", "720p", "1080p", "4k"]),
    duration: z.enum(["auto", "5s", "9s"]),
  }),
  image: z.object({
    provider: z.enum(["sketch", "higgsfield", "luma"]),
    model: z.enum(["photon-1", "photon-flash-1"]),
    higgsfieldQuality: z.enum(["720p", "1080p"]),
  }),
  render: z.object({
    transition: z.enum(["cut", "crossfade", "fadeblack"]),
    transitionSec: z.coerce.number().min(0).max(1.5),
    captions: z.boolean(),
    captionSize: z.coerce.number().min(40).max(120),
    musicVolume: z.coerce.number().min(0).max(1),
    sfxVolume: z.coerce.number().min(0).max(2),
    voiceVolume: z.coerce.number().min(0).max(2),
    fadeInOut: z.boolean(),
  }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  budget: { perSceneUsd: 2, perProjectUsd: 10, monthlyUsd: 25 },
  prices: DEFAULT_PRICES,
  video: { provider: "higgsfield", higgsfieldModel: "dop-turbo", model: "ray-flash-2", resolution: "720p", duration: "auto" },
  image: { provider: "higgsfield", model: "photon-flash-1", higgsfieldQuality: "1080p" },
  render: {
    transition: "crossfade",
    transitionSec: 0.35,
    captions: true,
    captionSize: 72,
    musicVolume: 0.18,
    sfxVolume: 0.8,
    voiceVolume: 1.0,
    fadeInOut: true,
  },
};

export function getSettings(): Settings {
  const row = db().prepare("SELECT value_json FROM settings WHERE key='app'").get() as { value_json: string } | undefined;
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), JSON.parse(row.value_json));
  const parsed = SettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_SETTINGS);
}

export function saveSettings(patch: unknown): Settings {
  const merged = deepMerge(getSettings(), patch);
  const parsed = SettingsSchema.parse(merged);
  db().prepare("INSERT INTO settings(key,value_json) VALUES('app',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify(parsed));
  return parsed;
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const cur = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" ? deepMerge(cur, v) : v;
  }
  return out as T;
}

/* --------------------------- Capability / mode ---------------------------- */

export interface Capabilities {
  demoMode: boolean;
  forceDemo: boolean;
  higgsfield: boolean;
  luma: boolean;
  publicBaseUrl: boolean;
  anthropic: boolean;
  openaiCompat: boolean;
  piper: boolean;
  flite: boolean;
  ffmpeg: boolean;
}

export function capabilities(tools?: { ffmpeg: boolean; flite: boolean }): Capabilities {
  const luma = !!config.luma.apiKey;
  const higgsfield = !!config.higgsfield.credentials;
  return {
    // Demo mode = no real video provider usable. Higgsfield is the preferred provider.
    demoMode: config.forceDemo || (!higgsfield && !luma),
    forceDemo: config.forceDemo,
    higgsfield: higgsfield && !config.forceDemo,
    luma: luma && !config.forceDemo,
    publicBaseUrl: !!config.publicBaseUrl,
    anthropic: !!config.anthropic.apiKey && !config.forceDemo,
    openaiCompat: !!(config.openaiCompat.baseUrl && config.openaiCompat.model),
    piper: !!(config.piper.bin && config.piper.voicesDir),
    flite: tools?.flite ?? true,
    ffmpeg: tools?.ffmpeg ?? true,
  };
}
