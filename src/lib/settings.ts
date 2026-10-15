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
  storyLlm: 0.02, // per story, for paid LLMs
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
  }),
  video: z.object({
    model: z.enum(["ray-2", "ray-flash-2"]),
    resolution: z.enum(["540p", "720p", "1080p", "4k"]),
    duration: z.enum(["5s", "9s"]),
  }),
  image: z.object({
    provider: z.enum(["sketch", "luma"]),
    model: z.enum(["photon-1", "photon-flash-1"]),
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
  video: { model: "ray-flash-2", resolution: "720p", duration: "5s" },
  image: { provider: "sketch", model: "photon-flash-1" },
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
  return {
    demoMode: config.forceDemo || !luma,
    forceDemo: config.forceDemo,
    luma: luma && !config.forceDemo,
    publicBaseUrl: !!config.publicBaseUrl,
    anthropic: !!config.anthropic.apiKey && !config.forceDemo,
    openaiCompat: !!(config.openaiCompat.baseUrl && config.openaiCompat.model),
    piper: !!(config.piper.bin && config.piper.voicesDir),
    flite: tools?.flite ?? true,
    ffmpeg: tools?.ffmpeg ?? true,
  };
}
