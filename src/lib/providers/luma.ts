import "server-only";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "../config";
import { redact } from "../log";
import { ProviderError, UnknownOutcomeError } from "./types";

/**
 * Minimal Luma Dream Machine API client.
 * Endpoints and fields verified against Luma's official SDK (lumaai@1.19.1, generated from their OpenAPI spec):
 *   POST   /generations/video   { prompt, model: ray-2|ray-flash-2, aspect_ratio, duration: "5s"|"9s", resolution, keyframes, loop, callback_url }
 *   POST   /generations/image   { prompt, model: photon-1|photon-flash-1, aspect_ratio, character_ref, image_ref, format }
 *   GET    /generations/{id}    → { id, state: queued|dreaming|completed|failed, failure_reason, assets: { video, image } }
 *   GET    /generations?limit&offset
 *   DELETE /generations/{id}
 *   GET    /credits             → { credit_balance } (USD cents)
 */

export interface LumaGeneration {
  id?: string;
  state?: "queued" | "dreaming" | "completed" | "failed";
  failure_reason?: string;
  created_at?: string;
  assets?: { video?: string; image?: string; progress_video?: string };
  request?: { prompt?: string; model?: string };
}

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...a) => fetch(...a);
/** Test hook: replace the HTTP transport. */
export function setLumaFetch(f: FetchLike | null) {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

const CONNECT_ERRORS = /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|CERT|certificate/i;

async function call<T>(method: string, path: string, body?: unknown, opts: { timeoutMs?: number; idempotent?: boolean } = {}): Promise<T> {
  const key = config.luma.apiKey;
  if (!key) throw new ProviderError("LUMA_API_KEY is not configured.");
  let res: Response;
  try {
    res = await fetchImpl(`${config.luma.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
  } catch (e) {
    const msg = redact((e as Error)?.message ?? e);
    const cause = redact((e as { cause?: { code?: string; message?: string } })?.cause?.code ?? (e as { cause?: Error })?.cause?.message ?? "");
    // For non-idempotent POSTs, a timeout/reset means Luma may have accepted the job.
    if (method === "POST" && !opts.idempotent && !CONNECT_ERRORS.test(`${msg} ${cause}`)) {
      throw new UnknownOutcomeError(`Luma did not respond (${msg}${cause ? `: ${cause}` : ""}). The job may or may not have been created.`);
    }
    throw new ProviderError(`Could not reach Luma: ${msg}${cause ? ` (${cause})` : ""}`);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 400);
    try {
      const j = JSON.parse(text);
      detail = j.detail ? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)) : j.error?.message ?? j.message ?? detail;
    } catch {
      /* not JSON */
    }
    const hint =
      res.status === 401 ? " — check LUMA_API_KEY" : res.status === 402 ? " — your Luma API credit balance is too low" : res.status === 429 ? " — rate limited; try again shortly" : "";
    if (res.status >= 500 && method === "POST") throw new UnknownOutcomeError(`Luma returned ${res.status}: ${redact(detail)}. The job may or may not have been created.`);
    throw new ProviderError(`Luma API error ${res.status}${hint}: ${redact(detail)}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export const luma = {
  createVideo: (body: Record<string, unknown>) => call<LumaGeneration>("POST", "/generations/video", body, { timeoutMs: 60_000 }),
  createImage: (body: Record<string, unknown>) => call<LumaGeneration>("POST", "/generations/image", body, { timeoutMs: 60_000 }),
  get: (id: string) => call<LumaGeneration>("GET", `/generations/${encodeURIComponent(id)}`),
  list: (limit = 20) => call<{ generations?: LumaGeneration[] } | LumaGeneration[]>("GET", `/generations?limit=${limit}&offset=0`),
  remove: (id: string) => call<void>("DELETE", `/generations/${encodeURIComponent(id)}`),
  credits: () => call<{ credit_balance: number }>("GET", "/credits"),
};

/** Download a remote asset (Luma CDN) with size and type sanity checks. */
export async function downloadTo(url: string, dest: string, expect: "video" | "image") {
  if (!/^https:\/\//.test(url)) throw new ProviderError("Refusing to download a non-HTTPS asset URL.");
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok || !res.body) throw new ProviderError(`Download failed (${res.status}) for generated ${expect}.`);
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.startsWith(expect) && !type.includes("octet-stream")) throw new ProviderError(`Unexpected content type "${type}" for generated ${expect}.`);
  const max = expect === "video" ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
  let size = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      size += chunk.byteLength;
      if (size > max) ctl.error(new Error("Downloaded file is too large"));
      else ctl.enqueue(chunk);
    },
  });
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body.pipeThrough(limiter) as never), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
}
