import "server-only";
import crypto from "node:crypto";
import { config } from "./config";
import { db } from "./db";

function secret(): string {
  const row = db().prepare("SELECT value_json FROM settings WHERE key='public_secret'").get() as { value_json: string } | undefined;
  if (row) return JSON.parse(row.value_json);
  const s = crypto.randomBytes(32).toString("hex");
  db().prepare("INSERT OR IGNORE INTO settings(key,value_json) VALUES('public_secret',?)").run(JSON.stringify(s));
  return s;
}

export function signPath(rel: string) {
  return crypto.createHmac("sha256", secret()).update(rel).digest("base64url").slice(0, 32);
}

export function verifyPath(rel: string, sig: string) {
  const expected = signPath(rel);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Publicly reachable, unguessable URL for one image (requires PUBLIC_BASE_URL). */
export function publicImageUrl(rel: string): string | null {
  if (!config.publicBaseUrl) return null;
  return `${config.publicBaseUrl}/api/public/${signPath(rel)}/${rel.split("/").map(encodeURIComponent).join("/")}`;
}
