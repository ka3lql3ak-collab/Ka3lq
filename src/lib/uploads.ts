import "server-only";
import fs from "node:fs";
import path from "node:path";
import { uniqueFile } from "./paths";
import { probe } from "./media/ffmpeg";
import { ValidationError } from "./repo";

const RULES = {
  video: { exts: [".mp4", ".mov", ".webm", ".m4v"], max: 400 * 1024 * 1024 },
  image: { exts: [".png", ".jpg", ".jpeg", ".webp"], max: 25 * 1024 * 1024 },
  audio: { exts: [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".webm"], max: 80 * 1024 * 1024 },
} as const;

/** Save an uploaded file safely: extension allow-list, size limit, generated filename, media probe. */
export async function saveUpload(file: File | null, kind: keyof typeof RULES, dir: string): Promise<{ abs: string; info: Awaited<ReturnType<typeof probe>> }> {
  if (!file || typeof file === "string") throw new ValidationError("No file was uploaded.");
  const rule = RULES[kind];
  const ext = path.extname(file.name || "").toLowerCase();
  if (!(rule.exts as readonly string[]).includes(ext)) throw new ValidationError(`Unsupported ${kind} type "${ext || "?"}". Allowed: ${rule.exts.join(", ")}`);
  if (file.size > rule.max) throw new ValidationError(`File too large (max ${Math.round(rule.max / 1024 / 1024)} MB).`);
  if (file.size === 0) throw new ValidationError("The uploaded file is empty.");
  const abs = uniqueFile(dir, ext === ".jpeg" ? "jpg" : ext.slice(1), `upload-${kind}`);
  fs.writeFileSync(abs, Buffer.from(await file.arrayBuffer()));
  try {
    const info = await probe(abs);
    if (kind === "video" && !info.hasVideo) throw new ValidationError("That file has no video stream.");
    if (kind === "audio" && !info.hasAudio) throw new ValidationError("That file has no audio stream.");
    if (kind === "image" && !info.width) throw new ValidationError("That file is not a readable image.");
    return { abs, info };
  } catch (e) {
    fs.rmSync(abs, { force: true });
    throw e instanceof ValidationError ? e : new ValidationError(`The file could not be read: ${(e as Error).message}`);
  }
}
