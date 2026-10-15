import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config";

export function dataDir() {
  const d = config.dataDir;
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function mediaRoot() {
  const d = path.join(dataDir(), "media");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Create (if needed) and return a media sub-directory. Segments are validated. */
export function mediaDir(...segments: string[]) {
  for (const s of segments) if (!SAFE_SEGMENT.test(s) || s === "." || s === "..") throw new Error(`Unsafe path segment: ${s}`);
  const d = path.join(mediaRoot(), ...segments);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Relative (to media root) path for storage in the DB. */
export function toRel(abs: string) {
  const rel = path.relative(mediaRoot(), abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Path escapes media root");
  return rel.split(path.sep).join("/");
}

/** Resolve a DB-stored relative path to an absolute path, refusing traversal. */
export function fromRel(rel: string) {
  if (!rel || rel.includes("\0")) throw new Error("Invalid media path");
  const abs = path.resolve(mediaRoot(), rel);
  const root = mediaRoot() + path.sep;
  if (!abs.startsWith(root)) throw new Error("Path escapes media root");
  return abs;
}

export function mediaUrl(rel: string | null | undefined) {
  return rel ? `/api/media/${rel.split("/").map(encodeURIComponent).join("/")}` : null;
}

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(9).toString("base64url");
}

export function uniqueFile(dir: string, ext: string, stem = "f") {
  return path.join(dir, `${stem}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}.${ext.replace(/^\./, "")}`);
}
