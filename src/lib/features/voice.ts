import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import { db } from "../db";
import { mediaDir, toRel, uniqueFile, fromRel } from "../paths";
import { createAsset, deleteAsset, listAssets, listScenes, projectCharacters, requireProject, requireScene, ValidationError, type Asset, type Character, type Scene } from "../repo";
import { getSettings } from "../settings";
import { importVoice, synthesize } from "../media/tts";
import { registerHandler } from "../jobs";
import type { VoiceConfig } from "../types";

export interface VoiceLine {
  sceneId: string;
  index: number;
  speaker: string;
  text: string;
  voice: VoiceConfig;
  key: string;
  asset: Asset | null;
  durationSec: number | null;
  needsRecording: boolean;
}

export function voiceFor(speaker: string, cast: Character[], narrator: VoiceConfig): VoiceConfig {
  if (/^narrator$/i.test(speaker)) return narrator;
  const c = cast.find((x) => x.name.toLowerCase() === speaker.toLowerCase());
  return c?.voice ?? { ...narrator, pitch: 1.2 };
}

export function lineKey(speaker: string, text: string, v: VoiceConfig) {
  const voicePart = v.engine === "recorded" ? "recorded" : JSON.stringify([v.engine, v.voice, v.pitch, v.speed, v.volume]);
  return crypto.createHash("sha1").update(`${speaker.toLowerCase()}|${text.trim()}|${voicePart}`).digest("hex").slice(0, 20);
}

/** Narration first, then dialogue, in the order written. */
export function sceneLines(scene: Scene, cast: Character[], narrator: VoiceConfig, assets: Asset[]): VoiceLine[] {
  const raw = [...(scene.narration.trim() ? [{ speaker: "Narrator", text: scene.narration }] : []), ...scene.dialogue];
  return raw.map((l, index) => {
    const voice = voiceFor(l.speaker, cast, narrator);
    const key = lineKey(l.speaker, l.text, voice);
    const asset = assets.find((a) => a.sceneId === scene.id && a.meta.key === key) ?? null;
    return { sceneId: scene.id, index, speaker: l.speaker, text: l.text, voice, key, asset, durationSec: asset ? Number(asset.meta.durationSec ?? 0) : null, needsRecording: voice.engine === "recorded" && !asset };
  });
}

export function projectVoiceLines(projectId: string) {
  requireProject(projectId);
  const cast = projectCharacters(projectId);
  const narrator = getSettings().render.narrator;
  const assets = listAssets({ projectId, kind: "voice" });
  return listScenes(projectId).map((sc) => ({ sceneId: sc.id, idx: sc.idx, durationSec: sc.durationSec, lines: sceneLines(sc, cast, narrator, assets) }));
}

/** Synthesize every missing line (recorded-voice lines are skipped and reported). Unused old takes are removed. */
export async function generateVoices(projectId: string, onProgress?: (p: number, msg: string) => void) {
  const scenes = projectVoiceLines(projectId);
  const all = scenes.flatMap((s) => s.lines);
  const todo = all.filter((l) => !l.asset && l.voice.engine !== "recorded");
  let done = 0;
  for (const l of todo) {
    onProgress?.(done / Math.max(1, todo.length), `Voicing ${l.speaker}: “${l.text.slice(0, 40)}”`);
    const out = uniqueFile(mediaDir("projects", projectId, "voice"), "wav", "line");
    const { durationSec } = await synthesize(l.text, l.voice, out);
    createAsset({ projectId, sceneId: l.sceneId, kind: "voice", path: toRel(out), provider: l.voice.engine, meta: { key: l.key, speaker: l.speaker, text: l.text, durationSec } });
    done++;
  }
  // Clean up voice files that no longer match any line (script or voice changed).
  const keys = new Set(all.map((l) => l.key));
  for (const a of listAssets({ projectId, kind: "voice" })) if (!keys.has(String(a.meta.key))) deleteAsset(a.id);
  return { generated: todo.length, total: all.length, missingRecordings: all.filter((l) => l.needsRecording).length };
}

/** Save a recorded/imported take for a specific line. */
export async function saveRecordedLine(projectId: string, sceneId: string, key: string, uploadedAbs: string) {
  const scene = requireScene(sceneId, projectId);
  const line = projectVoiceLines(projectId).find((s) => s.sceneId === scene.id)?.lines.find((l) => l.key === key);
  if (!line) throw new ValidationError("That line no longer exists (the script may have changed).");
  const out = uniqueFile(mediaDir("projects", projectId, "voice"), "wav", "rec");
  const { durationSec } = await importVoice(uploadedAbs, out);
  fs.rmSync(uploadedAbs, { force: true });
  for (const a of listAssets({ sceneId, kind: "voice" })) if (a.meta.key === key) deleteAsset(a.id);
  return createAsset({ projectId, sceneId, kind: "voice", path: toRel(out), provider: "recorded", meta: { key, speaker: line.speaker, text: line.text, durationSec } });
}

export async function previewVoice(voice: VoiceConfig, text: string) {
  const dir = mediaDir("previews");
  for (const f of fs.readdirSync(dir)) if (Date.now() - fs.statSync(`${dir}/${f}`).mtimeMs > 3600_000) fs.rmSync(`${dir}/${f}`, { force: true });
  const out = uniqueFile(dir, "wav", "preview");
  await synthesize(text, voice, out);
  return toRel(out);
}

export function registerVoiceHandlers() {
  registerHandler("voice.generate", async (ctx) => {
    const { projectId } = ctx.job.payload as { projectId: string };
    return generateVoices(projectId, (p, m) => ctx.progress(p, m));
  });
}

/* --------------------------- Editor options ------------------------------- */

export interface EditorOptions {
  music: "none" | "generated" | "upload";
  mood: "auto" | "major" | "playful" | "minor" | "mystery";
  musicAssetId: string | null;
  musicLicenseConfirmed: boolean;
  captions: "speech" | "captions" | "off";
  /** punchy = Shorts/reality-show edit (hard cuts, push-ins, cut whooshes, word-highlight captions, hook title). */
  editStyle: "auto" | "punchy" | "cinematic";
  includeUnapproved: boolean;
}

export const DEFAULT_EDITOR: EditorOptions = { music: "generated", mood: "auto", musicAssetId: null, musicLicenseConfirmed: false, captions: "speech", editStyle: "auto", includeUnapproved: false };

export function resolveEditStyle(style: EditorOptions["editStyle"], genre: string): "punchy" | "cinematic" {
  if (style !== "auto") return style;
  return genre === "drama" || genre === "funny" || genre === "twist" ? "punchy" : "cinematic";
}

export function getEditorOptions(projectId: string): EditorOptions {
  const row = db().prepare("SELECT value_json FROM settings WHERE key = ?").get(`editor:${projectId}`) as { value_json: string } | undefined;
  return { ...DEFAULT_EDITOR, ...(row ? JSON.parse(row.value_json) : {}) };
}

export function saveEditorOptions(projectId: string, patch: Partial<EditorOptions>) {
  const next = { ...getEditorOptions(projectId), ...patch };
  if (next.music === "upload" && next.musicAssetId) {
    const a = listAssets({ projectId, kind: "music" }).find((x) => x.id === next.musicAssetId);
    if (!a) throw new ValidationError("Selected music file not found.");
    if (!next.musicLicenseConfirmed) throw new ValidationError("Confirm you have the rights to use this music before selecting it.");
  }
  db().prepare("INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(`editor:${projectId}`, JSON.stringify(next));
  return next;
}

export function assetAbs(a: Asset) {
  return fromRel(a.path);
}
