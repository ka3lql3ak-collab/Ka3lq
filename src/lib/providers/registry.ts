import "server-only";
import fs from "node:fs";
import path from "node:path";
import { capabilities, type Settings } from "../settings";
import { config } from "../config";
import { estimateImageCost, estimateVideoCost } from "../costs";
import { mediaDir, uniqueFile, fromRel } from "../paths";
import { rasterize, referenceSvg, sceneSvg, type SceneSketchInput, type SketchCharacter } from "../media/sketch";
import { renderDemoClip } from "../media/demo-clip";
import { luma, downloadTo, type LumaGeneration } from "./luma";
import { ProviderError, type GenProvider, type GenerationRecord, type PollResult } from "./types";

function ownerDir(gen: GenerationRecord, sub: string) {
  return gen.projectId ? mediaDir("projects", gen.projectId, sub) : mediaDir("characters", gen.characterId ?? "misc", sub);
}

/* ------------------------------ Local sketch ------------------------------ */

const sketchImage: GenProvider = {
  id: "sketch",
  label: "Local sketch (free)",
  kind: "image",
  paid: false,
  demo: false,
  configured: () => ({ ok: true }),
  models: () => [{ id: "sketch-v1", label: "Storyboard sketch" }],
  estimate: () => 0,
  async submit(gen) {
    const p = gen.params as { sketch?: SceneSketchInput; reference?: SketchCharacter };
    const out = uniqueFile(ownerDir(gen, gen.characterId && !gen.sceneId ? "references" : "storyboards"), "png", "sketch");
    if (p.reference) await rasterize(referenceSvg(p.reference), out);
    else if (p.sketch) await rasterize(sceneSvg(p.sketch), out);
    else throw new ProviderError("Sketch request is missing scene data.");
    return { output: { file: out, meta: { sketch: true } } };
  },
};

/* ------------------------------- Demo video ------------------------------- */

const demoVideo: GenProvider = {
  id: "demo-video",
  label: "Demo placeholder clip (free, NOT AI)",
  kind: "video",
  paid: false,
  demo: true,
  configured: () => ({ ok: true }),
  models: () => [{ id: "demo-kenburns", label: "Storyboard pan & zoom (placeholder)" }],
  estimate: () => 0,
  async submit(gen) {
    const p = gen.params as { sourceImage?: string; durationSec?: number; sketch?: SceneSketchInput };
    const dir = ownerDir(gen, "clips");
    let src = p.sourceImage ? fromRel(p.sourceImage) : null;
    if (!src || !fs.existsSync(src)) {
      if (!p.sketch) throw new ProviderError("Demo clip needs a storyboard image.");
      src = uniqueFile(dir, "png", "demo-src");
      await rasterize(sceneSvg(p.sketch), src);
    }
    const out = uniqueFile(dir, "mp4", "demo");
    await renderDemoClip(src, out, Math.max(2, Math.min(9, p.durationSec ?? 5)));
    return { output: { file: out, meta: { demo: true } } };
  },
};

/* ---------------------------------- Luma ---------------------------------- */

function lumaConfigured() {
  const c = capabilities();
  if (c.forceDemo) return { ok: false, reason: "DEMO_MODE=true is set." };
  if (!config.luma.apiKey) return { ok: false, reason: "Set LUMA_API_KEY in .env.local (https://lumalabs.ai/api/keys)." };
  return { ok: true };
}

function lumaPoll(kind: "image" | "video") {
  return async (gen: GenerationRecord): Promise<PollResult> => {
    const g = await luma.get(gen.providerJobId!);
    if (g.state === "completed") {
      const url = kind === "video" ? g.assets?.video : g.assets?.image;
      if (!url) return { state: "failed", error: "Luma reported completion but returned no asset URL." };
      return { state: "completed", outputUrl: url };
    }
    if (g.state === "failed") return { state: "failed", error: g.failure_reason || "Luma reported the generation failed." };
    return { state: g.state === "dreaming" ? "generating" : "queued" };
  };
}

async function lumaReconcile(gen: GenerationRecord): Promise<string | null> {
  const r = await luma.list(30);
  const items: LumaGeneration[] = Array.isArray(r) ? r : r.generations ?? [];
  const since = (gen.submittedAt ?? gen.createdAt) - 60_000;
  const match = items.find((g) => g.request?.prompt === gen.prompt && (!g.created_at || Date.parse(g.created_at) >= since));
  return match?.id ?? null;
}

const lumaBalance = async () => {
  try {
    const c = await luma.credits();
    return typeof c.credit_balance === "number" ? c.credit_balance / 100 : null;
  } catch {
    return null;
  }
};

const lumaImage: GenProvider = {
  id: "luma-image",
  label: "Luma Photon (paid)",
  kind: "image",
  paid: true,
  demo: false,
  configured: lumaConfigured,
  models: () => [
    { id: "photon-flash-1", label: "Photon Flash (cheaper)" },
    { id: "photon-1", label: "Photon (higher quality)" },
  ],
  estimate: (s: Settings, model) => estimateImageCost(s, model),
  async submit(gen) {
    const p = gen.params as { aspectRatio?: string; characterRefs?: string[]; imageRefs?: string[] };
    const body: Record<string, unknown> = { prompt: gen.prompt, model: gen.model, aspect_ratio: p.aspectRatio ?? "9:16", format: "png" };
    if (p.characterRefs?.length) body.character_ref = { identity0: { images: p.characterRefs.slice(0, 4) } };
    if (p.imageRefs?.length) body.image_ref = p.imageRefs.slice(0, 4).map((url) => ({ url, weight: 0.6 }));
    const g = await luma.createImage(body);
    if (!g.id) throw new ProviderError("Luma did not return a generation id.");
    return { providerJobId: g.id };
  },
  poll: lumaPoll("image"),
  reconcile: lumaReconcile,
  cancel: async (gen) => {
    if (gen.providerJobId) await luma.remove(gen.providerJobId);
  },
  download: (url, dest) => downloadTo(url, dest, "image"),
  balanceUsd: lumaBalance,
};

const lumaVideo: GenProvider = {
  id: "luma-video",
  label: "Luma Ray (paid)",
  kind: "video",
  paid: true,
  demo: false,
  configured: lumaConfigured,
  models: () => [
    { id: "ray-flash-2", label: "Ray Flash 2 (faster, cheaper)", resolutions: ["540p", "720p", "1080p", "4k"], durations: ["5s", "9s"] },
    { id: "ray-2", label: "Ray 2 (higher quality)", resolutions: ["540p", "720p", "1080p", "4k"], durations: ["5s", "9s"] },
  ],
  estimate: (s: Settings, model, params) => estimateVideoCost(s, model, String(params.resolution ?? "720p"), String(params.duration ?? "5s")),
  async submit(gen) {
    const p = gen.params as { resolution: string; duration: string; keyframeUrl?: string | null; callbackUrl?: string | null };
    const body: Record<string, unknown> = {
      prompt: gen.prompt,
      model: gen.model,
      aspect_ratio: "9:16",
      resolution: p.resolution,
      duration: p.duration,
      loop: false,
    };
    if (p.keyframeUrl) body.keyframes = { frame0: { type: "image", url: p.keyframeUrl } };
    if (p.callbackUrl) body.callback_url = p.callbackUrl;
    const g = await luma.createVideo(body);
    if (!g.id) throw new ProviderError("Luma did not return a generation id.");
    return { providerJobId: g.id };
  },
  poll: lumaPoll("video"),
  reconcile: lumaReconcile,
  cancel: async (gen) => {
    if (gen.providerJobId) await luma.remove(gen.providerJobId);
  },
  download: (url, dest) => downloadTo(url, dest, "video"),
  balanceUsd: lumaBalance,
};

/* -------------------------------- Registry -------------------------------- */

const PROVIDERS: Record<string, GenProvider> = {
  [sketchImage.id]: sketchImage,
  [demoVideo.id]: demoVideo,
  [lumaImage.id]: lumaImage,
  [lumaVideo.id]: lumaVideo,
};

/** Test hook: register an extra provider (e.g. a fake paid provider). */
export function registerProvider(p: GenProvider) {
  PROVIDERS[p.id] = p;
}

export function getProvider(id: string): GenProvider {
  const p = PROVIDERS[id];
  if (!p) throw new ProviderError(`Unknown provider "${id}".`);
  return p;
}

export function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, kind: p.kind, paid: p.paid, demo: p.demo, configured: p.configured(), models: p.models() }));
}

/** The provider used by default for each kind given the current configuration. */
export function defaultProvider(kind: "image" | "video", s: Settings): GenProvider {
  if (kind === "video") return lumaVideo.configured().ok ? lumaVideo : demoVideo;
  return s.image.provider === "luma" && lumaImage.configured().ok ? lumaImage : sketchImage;
}

export function extFor(kind: "image" | "video", url: string) {
  const e = path.extname(new URL(url).pathname).toLowerCase().replace(".", "");
  if (kind === "video") return e === "webm" ? "webm" : "mp4";
  return ["png", "jpg", "jpeg", "webp"].includes(e) ? e : "png";
}
