import fs from "node:fs";
import path from "node:path";
import { fromRel } from "@/lib/paths";
import { verifyPath } from "@/lib/public-url";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Signed, read-only access to individual images so AI providers can fetch keyframes. */
export async function GET(_req: Request, ctx: { params: Promise<{ sig: string; path: string[] }> }) {
  const { sig, path: segs } = await ctx.params;
  const rel = segs.map((s) => decodeURIComponent(s)).join("/");
  if (!verifyPath(rel, sig)) return new Response("Forbidden", { status: 403 });
  let abs: string;
  try {
    abs = fromRel(rel);
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  const type = TYPES[path.extname(abs).toLowerCase()];
  if (!type || !fs.existsSync(abs)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(abs), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" } });
}
