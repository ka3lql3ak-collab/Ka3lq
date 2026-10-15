import "server-only";
import { getSettings } from "../settings";
import { config } from "../config";
import { requestGeneration } from "../generations";
import { defaultProvider, getProvider } from "../providers/registry";
import type { GenProvider } from "../providers/types";
import { buildReferencePrompt, buildScenePrompt } from "../story/prompt";
import { getAsset, listScenes, projectCharacters, requireCharacter, requireProject, requireScene, ValidationError, type Character, type Scene } from "../repo";
import { publicImageUrl, signPath } from "../public-url";
import type { SceneSketchInput } from "../media/sketch";
import { estimateHiggsfieldVideo, estimateVideoCost } from "../costs";

export interface GenOptions {
  providerId?: string;
  model?: string;
  requestId: string;
  confirmCost?: boolean;
  estimate?: number;
}

function castFor(scene: Scene, cast: Character[]) {
  const inScene = cast.filter((c) => scene.characters.some((n) => n.toLowerCase() === c.name.toLowerCase()));
  return inScene.length ? inScene : cast.slice(0, 1);
}

export function sketchInput(scene: Scene, cast: Character[]): SceneSketchInput {
  return {
    index: scene.idx,
    beat: scene.beat,
    visual: scene.visual,
    camera: scene.camera,
    emotion: scene.emotion,
    caption: scene.caption,
    characters: castFor(scene, cast).map((c) => ({ name: c.name, fruit: c.fruit, palette: c.palette })),
  };
}

/** URL a provider can fetch for an image asset: the provider's own CDN URL, else a signed public URL. */
export function fetchableUrl(assetId: string | null): string | null {
  if (!assetId) return null;
  const a = getAsset(assetId);
  if (!a) return null;
  if (a.remoteUrl && /^https:\/\//.test(a.remoteUrl)) return a.remoteUrl;
  return publicImageUrl(a.path);
}

/** An approved reference usable by AI models: never a planning sketch. */
function aiReference(c: Character) {
  const a = c.approvedImageId ? getAsset(c.approvedImageId) : null;
  return a && a.provider !== "sketch" ? a : null;
}

function imageModel(provider: GenProvider, o: GenOptions, s: ReturnType<typeof getSettings>) {
  if (o.model) return o.model;
  if (provider.id === "luma-image") return s.image.model;
  if (provider.id === "higgsfield-image") return `soul-${s.image.higgsfieldQuality}`;
  return provider.models()[0].id;
}

export function requestStoryboard(projectId: string, sceneId: string, o: GenOptions) {
  const p = requireProject(projectId);
  const scene = requireScene(sceneId, projectId);
  const cast = projectCharacters(projectId);
  const s = getSettings();
  const provider = o.providerId ? getProvider(o.providerId) : defaultProvider("image", s);
  const present = castFor(scene, cast);
  const refs = present.map(aiReference);
  const params: Record<string, unknown> = { aspectRatio: "9:16", sketch: sketchInput(scene, cast) };
  if (provider.id === "luma-image") {
    const refUrls = refs.map((a) => (a ? fetchableUrl(a.id) : null));
    // Primary character identity via character_ref; others as image references (best effort).
    if (refUrls[0]) params.characterRefs = [refUrls[0]];
    const others = refUrls.slice(1).filter(Boolean) as string[];
    if (others.length) params.imageRefs = others;
  }
  if (provider.id === "higgsfield-image") {
    // Soul accepts one image_reference: use the primary character's approved reference.
    params.widthAndHeight = "1152x2048"; // exact 9:16, documented Soul size
    const primary = refs.find(Boolean);
    if (primary) {
      params.referenceRemote = primary.remoteUrl;
      params.referenceLocal = primary.path;
    }
  }
  params.referencesUsed = present.filter((_, i) => !!refs[i]).map((c) => c.name);
  return requestGeneration({
    kind: "image",
    providerId: provider.id,
    model: imageModel(provider, o, s),
    prompt: buildScenePrompt(scene, present, p.settings.visualStyle, { forImage: true }),
    params,
    projectId,
    sceneId,
    requestId: o.requestId,
    confirmCost: o.confirmCost,
    estimate: o.estimate,
  });
}

export function requestReference(characterId: string, o: GenOptions & { visualStyle?: string }) {
  const c = requireCharacter(characterId);
  const s = getSettings();
  const provider = o.providerId ? getProvider(o.providerId) : defaultProvider("image", s);
  return requestGeneration({
    kind: "image",
    providerId: provider.id,
    model: imageModel(provider, o, s),
    prompt: buildReferencePrompt(c, (o.visualStyle as never) ?? "3d family film"),
    params: { aspectRatio: "1:1", widthAndHeight: "1536x1536", reference: { name: c.name, fruit: c.fruit, palette: c.palette } },
    characterId,
    requestId: o.requestId,
    confirmCost: o.confirmCost,
    estimate: o.estimate,
  });
}

export function clipDurationFor(sceneSec: number, setting: "auto" | "5s" | "9s") {
  if (setting !== "auto") return setting;
  return sceneSec <= 5 ? "5s" : "9s";
}

export interface ClipPlan {
  providerId: string;
  model: string;
  resolution: string | null;
  duration: string | null;
  mode: "image-to-video" | "text-to-video" | "demo" | "blocked";
  keyframeSource: string | null;
  estimate: number;
  note: string | null;
  preferred: string;
  preferredConfigured: boolean;
}

const PREFERRED_LABEL: Record<string, string> = { higgsfield: "Higgsfield", luma: "Luma", manual: "Manual import" };

/** Decide how a scene's clip will be generated (shown to the user before paying). */
export function planClip(projectId: string, sceneId: string, o: { providerId?: string; model?: string; resolution?: string; duration?: string; useKeyframe?: boolean } = {}): ClipPlan {
  const scene = requireScene(sceneId, projectId);
  const s = getSettings();
  const provider = o.providerId ? getProvider(o.providerId) : defaultProvider("video", s);
  const preferred = s.video.provider;
  const preferredConfigured = preferred === "higgsfield" ? getProvider("higgsfield-video").configured().ok : preferred === "luma" ? getProvider("luma-video").configured().ok : false;
  const base = { preferred, preferredConfigured };
  const board = scene.storyboardAssetId ? getAsset(scene.storyboardAssetId) : null;

  if (provider.demo) {
    const why =
      preferred === "manual"
        ? "Manual mode: generate this clip in the Higgsfield app and import it."
        : !preferredConfigured
          ? `${PREFERRED_LABEL[preferred]} API isn't configured, so only a free demo placeholder can be made here. You can also generate the clip in the Higgsfield app and import it.`
          : "Demo placeholder.";
    return { ...base, providerId: provider.id, model: provider.models()[0].id, resolution: "720p", duration: `${scene.durationSec}s`, mode: "demo", keyframeSource: "storyboard", estimate: 0, note: `${why} Pans across the storyboard — NOT AI video.` };
  }

  if (provider.id === "higgsfield-video") {
    const model = o.model ?? s.video.higgsfieldModel;
    const estimate = estimateHiggsfieldVideo(s, model);
    const fit = `Clip length is decided by Higgsfield DoP (no documented duration parameter); the editor trims it or holds the last frame to fit this ${scene.durationSec}s scene.`;
    if (!board || board.provider === "sketch") {
      return { ...base, providerId: provider.id, model, resolution: null, duration: null, mode: "blocked", keyframeSource: null, estimate, note: "Higgsfield DoP animates a keyframe image. Generate an AI keyframe for this scene (Storyboard → AI) or upload one — sketches are never used as keyframes." };
    }
    return { ...base, providerId: provider.id, model, resolution: null, duration: null, mode: "image-to-video", keyframeSource: board.provider === "upload" ? "uploaded image" : board.provider === "higgsfield-image" ? "Higgsfield Soul keyframe" : "AI keyframe", estimate, note: fit };
  }

  // Luma (optional secondary provider; only used when chosen in Settings).
  const model = o.model ?? s.video.model;
  const resolution = o.resolution ?? s.video.resolution;
  const duration = (o.duration as "5s" | "9s") ?? clipDurationFor(scene.durationSec, s.video.duration);
  let mode: ClipPlan["mode"] = "text-to-video";
  let keyframeSource: string | null = null;
  let note: string | null = null;
  if (o.useKeyframe !== false && board) {
    if (board.provider === "sketch") note = "Storyboard is a planning sketch, so it is not used as a keyframe. Generate an AI keyframe for image-to-video.";
    else if (fetchableUrl(board.id)) {
      mode = "image-to-video";
      keyframeSource = board.provider === "upload" ? "uploaded image" : "AI keyframe";
    } else note = "Your keyframe image is local; set PUBLIC_BASE_URL so Luma can fetch it. Using text-to-video.";
  }
  return { ...base, providerId: provider.id, model, resolution, duration, mode, keyframeSource, estimate: estimateVideoCost(s, model, resolution, duration), note };
}

export function requestClip(projectId: string, sceneId: string, o: GenOptions & { resolution?: string; duration?: string; useKeyframe?: boolean }) {
  const p = requireProject(projectId);
  const scene = requireScene(sceneId, projectId);
  const cast = projectCharacters(projectId);
  const plan = planClip(projectId, sceneId, o);
  const prompt = buildScenePrompt(scene, castFor(scene, cast), p.settings.visualStyle);
  const board = scene.storyboardAssetId ? getAsset(scene.storyboardAssetId) : null;
  if (plan.mode === "blocked") throw new ValidationError(plan.note ?? "This clip can't be generated yet.");
  let params: Record<string, unknown>;
  if (plan.mode === "demo") params = { sourceImage: board && board.provider !== "sketch" ? board.path : null, durationSec: scene.durationSec, sketch: sketchInput(scene, cast), mode: "demo" };
  else if (plan.providerId === "higgsfield-video")
    params = {
      mode: plan.mode,
      keyframeRemote: board?.remoteUrl ?? null,
      keyframeLocal: board?.path ?? null,
      sceneDurationSec: scene.durationSec,
      webhookUrl: config.publicBaseUrl ? `${config.publicBaseUrl}/api/webhooks/higgsfield/${signPath("higgsfield-webhook")}` : null,
    };
  else
    params = {
      resolution: plan.resolution,
      duration: plan.duration,
      mode: plan.mode,
      keyframeUrl: plan.mode === "image-to-video" ? fetchableUrl(board!.id) : null,
      callbackUrl: config.publicBaseUrl ? `${config.publicBaseUrl}/api/webhooks/luma/${signPath("luma-webhook")}` : null,
    };
  return { plan, ...requestGeneration({ kind: "video", providerId: plan.providerId, model: plan.model, prompt, params, projectId, sceneId, requestId: o.requestId, confirmCost: o.confirmCost, estimate: o.estimate }) };
}

/** Free: sketch every scene that has no storyboard yet (or all, when `all`). */
export function sketchAllStoryboards(projectId: string, all = false) {
  const scenes = listScenes(projectId).filter((s) => all || !s.storyboardAssetId);
  if (!scenes.length) throw new ValidationError("Every scene already has a storyboard.");
  const stamp = Date.now().toString(36);
  return scenes.map((s) => requestStoryboard(projectId, s.id, { providerId: "sketch", requestId: `bulk-${stamp}-${s.id}`.slice(0, 64) }).generation);
}

/** Free in demo mode: generate placeholder clips for scenes without a clip. */
export function demoAllClips(projectId: string) {
  const scenes = listScenes(projectId).filter((s) => !s.clipAssetId);
  const stamp = Date.now().toString(36);
  return scenes.map((s) => requestClip(projectId, s.id, { providerId: "demo-video", requestId: `demo-${stamp}-${s.id}`.slice(0, 64) }).generation);
}

/** The exact prompt a clip request would use (also offered for copy/paste into the Higgsfield app). */
export function clipPrompt(projectId: string, sceneId: string) {
  const p = requireProject(projectId);
  const scene = requireScene(sceneId, projectId);
  return buildScenePrompt(scene, castFor(scene, projectCharacters(projectId)), p.settings.visualStyle);
}
