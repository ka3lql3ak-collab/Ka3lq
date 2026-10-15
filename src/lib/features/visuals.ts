import "server-only";
import { getSettings } from "../settings";
import { config } from "../config";
import { requestGeneration } from "../generations";
import { defaultProvider, getProvider } from "../providers/registry";
import { buildReferencePrompt, buildScenePrompt } from "../story/prompt";
import { getAsset, listScenes, projectCharacters, requireCharacter, requireProject, requireScene, ValidationError, type Character, type Scene } from "../repo";
import { publicImageUrl, signPath } from "../public-url";
import type { SceneSketchInput } from "../media/sketch";
import { estimateVideoCost } from "../costs";

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

export function requestStoryboard(projectId: string, sceneId: string, o: GenOptions) {
  const p = requireProject(projectId);
  const scene = requireScene(sceneId, projectId);
  const cast = projectCharacters(projectId);
  const s = getSettings();
  const provider = o.providerId ? getProvider(o.providerId) : defaultProvider("image", s);
  const present = castFor(scene, cast);
  const refUrls = present.map((c) => fetchableUrl(c.approvedImageId));
  const params: Record<string, unknown> = { aspectRatio: "9:16", sketch: sketchInput(scene, cast) };
  if (provider.id === "luma-image") {
    // Primary character identity via character_ref; others as image references (best effort).
    if (refUrls[0]) params.characterRefs = [refUrls[0]];
    const others = refUrls.slice(1).filter(Boolean) as string[];
    if (others.length) params.imageRefs = others;
    params.referencesUsed = present.filter((_, i) => !!refUrls[i]).map((c) => c.name);
  }
  return requestGeneration({
    kind: "image",
    providerId: provider.id,
    model: o.model ?? (provider.id === "luma-image" ? s.image.model : provider.models()[0].id),
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
    model: o.model ?? (provider.id === "luma-image" ? s.image.model : provider.models()[0].id),
    prompt: buildReferencePrompt(c, (o.visualStyle as never) ?? "3d family film"),
    params: { aspectRatio: "1:1", reference: { name: c.name, fruit: c.fruit, palette: c.palette } },
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
  resolution: string;
  duration: string;
  mode: "image-to-video" | "text-to-video" | "demo";
  keyframeSource: string | null;
  estimate: number;
  note: string | null;
}

/** Decide how a scene's clip will be generated (shown to the user before paying). */
export function planClip(projectId: string, sceneId: string, o: { providerId?: string; model?: string; resolution?: string; duration?: string; useKeyframe?: boolean } = {}): ClipPlan {
  const scene = requireScene(sceneId, projectId);
  const s = getSettings();
  const provider = o.providerId ? getProvider(o.providerId) : defaultProvider("video", s);
  if (provider.demo) return { providerId: provider.id, model: provider.models()[0].id, resolution: "720p", duration: `${scene.durationSec}s`, mode: "demo", keyframeSource: "storyboard", estimate: 0, note: "Demo placeholder: pans across the storyboard. Not AI video." };
  const model = o.model ?? s.video.model;
  const resolution = o.resolution ?? s.video.resolution;
  const duration = (o.duration as "5s" | "9s") ?? clipDurationFor(scene.durationSec, s.video.duration);
  const board = scene.storyboardAssetId ? getAsset(scene.storyboardAssetId) : null;
  let mode: ClipPlan["mode"] = "text-to-video";
  let keyframeSource: string | null = null;
  let note: string | null = null;
  if (o.useKeyframe !== false && board) {
    if (board.provider === "sketch") note = "Storyboard is a planning sketch, so it is not used as a keyframe (it would make the clip look like a sketch). Generate an AI storyboard frame for image-to-video.";
    else if (fetchableUrl(board.id)) {
      mode = "image-to-video";
      keyframeSource = board.provider === "upload" ? "uploaded image" : "AI storyboard frame";
    } else note = "Your keyframe image is local; set PUBLIC_BASE_URL so Luma can fetch it. Using text-to-video.";
  }
  return { providerId: provider.id, model, resolution, duration, mode, keyframeSource, estimate: estimateVideoCost(s, model, resolution, duration), note };
}

export function requestClip(projectId: string, sceneId: string, o: GenOptions & { resolution?: string; duration?: string; useKeyframe?: boolean }) {
  const p = requireProject(projectId);
  const scene = requireScene(sceneId, projectId);
  const cast = projectCharacters(projectId);
  const plan = planClip(projectId, sceneId, o);
  const prompt = buildScenePrompt(scene, castFor(scene, cast), p.settings.visualStyle);
  const board = scene.storyboardAssetId ? getAsset(scene.storyboardAssetId) : null;
  const params: Record<string, unknown> =
    plan.mode === "demo"
      ? { sourceImage: board?.path ?? null, durationSec: scene.durationSec, sketch: sketchInput(scene, cast), mode: "demo" }
      : {
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
