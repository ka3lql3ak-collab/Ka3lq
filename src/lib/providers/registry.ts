import "server-only";
import fs from "node:fs";
import path from "node:path";
import { capabilities, type Settings } from "../settings";
import { config } from "../config";
import { estimateImageCost, estimateVideoCost, estimateHiggsfieldImage, estimateHiggsfieldVideo } from "../costs";
import { higgsfield, downloadHiggsfieldAsset, type HiggsfieldResponse } from "./higgsfield";
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
      await rasterize(sceneSvg(p.sketch, 540, 960, { clean: true }), src);
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

/* ------------------------------- Higgsfield ------------------------------- */

function higgsfieldConfigured() {
  const c = capabilities();
  if (c.forceDemo) return { ok: false, reason: "DEMO_MODE=true is set." };
  if (!config.higgsfield.credentials) return { ok: false, reason: "Set HF_KEY=KEY_ID:KEY_SECRET in .env.local (create an API key at https://cloud.higgsfield.ai — the API needs its own funded balance)." };
  return { ok: true };
}

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Turn a local or remote image into a URL Higgsfield can read (uploads local files to Higgsfield's CDN). */
async function higgsfieldImageUrl(remote: string | null | undefined, local: string | null | undefined): Promise<string | null> {
  if (remote && /^https:\/\//.test(remote)) return remote;
  if (!local) return null;
  const abs = fromRel(local);
  const type = MIME[path.extname(abs).toLowerCase()];
  if (!type) throw new ProviderError("Keyframe/reference must be a PNG, JPEG or WebP image.");
  return higgsfield.uploadFile(abs, type);
}

function higgsfieldPoll(kind: "image" | "video") {
  return async (gen: GenerationRecord): Promise<PollResult> => {
    const r: HiggsfieldResponse = await higgsfield.status(gen.providerJobId!);
    switch (r.status) {
      case "completed": {
        const url = kind === "video" ? r.video?.url : r.images?.[0]?.url;
        return url ? { state: "completed", outputUrl: url } : { state: "failed", error: "Higgsfield reported completion but returned no media URL." };
      }
      case "failed":
        return { state: "failed", error: "Higgsfield reported the generation failed (Higgsfield refunds credits for failed requests)." };
      case "nsfw":
        return { state: "failed", error: "Rejected by Higgsfield content moderation (credits refunded). Rephrase the prompt or change the keyframe." };
      case "canceled":
        return { state: "failed", error: "The request was cancelled at Higgsfield." };
      case "in_progress":
        return { state: "generating" };
      default:
        return { state: "queued" };
    }
  };
}

async function higgsfieldCancel(gen: GenerationRecord) {
  if (!gen.providerJobId) return;
  try {
    await higgsfield.cancel(gen.providerJobId);
  } catch (e) {
    if ((e as ProviderError).status === 400) throw new ProviderError("Higgsfield only cancels queued requests; this one is already processing and will finish (and be billed).", 400);
    throw e;
  }
}

const higgsfieldImage: GenProvider = {
  id: "higgsfield-image",
  label: "Higgsfield Soul (paid)",
  kind: "image",
  paid: true,
  demo: false,
  configured: higgsfieldConfigured,
  models: () => [
    { id: "soul-1080p", label: "Soul · 1080p" },
    { id: "soul-720p", label: "Soul · 720p (cheaper)" },
  ],
  estimate: (s: Settings, model) => estimateHiggsfieldImage(s, model.replace("soul-", "")),
  async submit(gen) {
    const p = gen.params as { widthAndHeight?: string; referenceRemote?: string | null; referenceLocal?: string | null; seed?: number };
    const args: Record<string, unknown> = {
      prompt: gen.prompt,
      width_and_height: p.widthAndHeight ?? "1152x2048",
      quality: gen.model === "soul-720p" ? "720p" : "1080p",
      batch_size: 1,
      enhance_prompt: false,
    };
    const ref = await higgsfieldImageUrl(p.referenceRemote, p.referenceLocal);
    if (ref) args.image_reference = { type: "image_url", image_url: ref };
    if (typeof p.seed === "number") args.seed = p.seed;
    const r = await higgsfield.submit("/v1/text2image/soul", args);
    return { providerJobId: r.request_id! };
  },
  poll: higgsfieldPoll("image"),
  cancel: higgsfieldCancel,
  download: (url, dest) => downloadHiggsfieldAsset(url, dest, "image"),
};

const higgsfieldVideo: GenProvider = {
  id: "higgsfield-video",
  label: "Higgsfield DoP image-to-video (paid)",
  kind: "video",
  paid: true,
  demo: false,
  configured: higgsfieldConfigured,
  models: () => [
    { id: "dop-lite", label: "DoP Lite (basic speed & quality)" },
    { id: "dop-turbo", label: "DoP Turbo (2× speed, priority queue)" },
    { id: "dop-standard", label: "DoP Standard (highest quality)" },
  ],
  estimate: (s: Settings, model) => estimateHiggsfieldVideo(s, model),
  async submit(gen) {
    const p = gen.params as { keyframeRemote?: string | null; keyframeLocal?: string | null; webhookUrl?: string | null; seed?: number };
    const image = await higgsfieldImageUrl(p.keyframeRemote, p.keyframeLocal);
    if (!image) throw new ProviderError("Higgsfield DoP needs a keyframe image for this scene.");
    const args: Record<string, unknown> = { model: gen.model, prompt: gen.prompt, input_images: [{ type: "image_url", image_url: image }], enhance_prompt: false };
    if (typeof p.seed === "number") args.seed = p.seed;
    const r = await higgsfield.submit("/v1/image2video/dop", args, p.webhookUrl);
    return { providerJobId: r.request_id! };
  },
  poll: higgsfieldPoll("video"),
  cancel: higgsfieldCancel,
  download: (url, dest) => downloadHiggsfieldAsset(url, dest, "video"),
};

/* -------------------------------- Registry -------------------------------- */

const PROVIDERS: Record<string, GenProvider> = {
  [sketchImage.id]: sketchImage,
  [demoVideo.id]: demoVideo,
  [lumaImage.id]: lumaImage,
  [lumaVideo.id]: lumaVideo,
  [higgsfieldImage.id]: higgsfieldImage,
  [higgsfieldVideo.id]: higgsfieldVideo,
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

/**
 * The provider used by default for each kind. Follows the user's chosen provider and NEVER silently
 * substitutes another paid provider: if the chosen one isn't configured, only the free demo/sketch
 * providers are offered (clearly labelled), plus manual import.
 */
export function defaultProvider(kind: "image" | "video", s: Settings): GenProvider {
  if (kind === "video") {
    if (s.video.provider === "higgsfield" && higgsfieldVideo.configured().ok) return higgsfieldVideo;
    if (s.video.provider === "luma" && lumaVideo.configured().ok) return lumaVideo;
    return demoVideo;
  }
  if (s.image.provider === "higgsfield" && higgsfieldImage.configured().ok) return higgsfieldImage;
  if (s.image.provider === "luma" && lumaImage.configured().ok) return lumaImage;
  return sketchImage;
}

/** Which AI image provider pairs with the chosen video provider (for keyframes). */
export function keyframeProviderFor(s: Settings): GenProvider | null {
  if (s.video.provider === "higgsfield") return higgsfieldImage.configured().ok ? higgsfieldImage : null;
  if (s.video.provider === "luma") return lumaImage.configured().ok ? lumaImage : null;
  return null;
}

export function extFor(kind: "image" | "video", url: string) {
  const e = path.extname(new URL(url).pathname).toLowerCase().replace(".", "");
  if (kind === "video") return e === "webm" ? "webm" : "mp4";
  return ["png", "jpg", "jpeg", "webp"].includes(e) ? e : "png";
}
