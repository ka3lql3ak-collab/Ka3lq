import fs from "node:fs";
import path from "node:path";
import { fromRel } from "@/lib/paths";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".ass": "text/plain; charset=utf-8",
};

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segs } = await ctx.params;
  let abs: string;
  try {
    abs = fromRel(segs.map((s) => decodeURIComponent(s)).join("/"));
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  const type = TYPES[path.extname(abs).toLowerCase()];
  if (!type) return new Response("Unsupported file type", { status: 415 });
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
    if (!stat.isFile()) throw new Error();
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    // SVGs are rendered as images only; never as documents with scripts.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  };
  if (url.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="${path.basename(abs).replace(/[^A-Za-z0-9._-]/g, "_")}"`;

  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (!m[1] && m[2]) {
        start = Math.max(0, stat.size - parseInt(m[2], 10));
        end = stat.size - 1;
      }
      if (start >= stat.size || end >= stat.size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
      }
      const stream = fs.createReadStream(abs, { start, end });
      return new Response(nodeToWeb(stream), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
      });
    }
  }
  return new Response(nodeToWeb(fs.createReadStream(abs)), { headers: { ...headers, "Content-Length": String(stat.size) } });
}

function nodeToWeb(stream: fs.ReadStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk)));
      stream.on("end", () => controller.close());
      stream.on("error", (e) => controller.error(e));
    },
    cancel() {
      stream.destroy();
    },
  });
}
