import "server-only";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "../config";
import { redact } from "../log";
import { ProviderError, UnknownOutcomeError } from "./types";

/**
 * Higgsfield Cloud API adapter.
 *
 * Contract verified against Higgsfield's official SDKs (@higgsfield/client 0.2.6 for Node,
 * higgsfield-client 0.2.0 for Python), because docs.higgsfield.ai was unreachable from the build
 * environment:
 *   Auth:    Authorization: Key KEY_ID:KEY_SECRET        (credentials from https://cloud.higgsfield.ai)
 *   Submit:  POST {base}/{application}[?hf_webhook=URL]   body = model arguments (JSON)
 *            → { request_id, status, status_url, cancel_url }
 *   Status:  GET  {base}/requests/{id}/status
 *            → { status: queued|in_progress|completed|failed|nsfw|canceled, images?: [{url}], video?: {url} }
 *            failed / nsfw: credits are refunded (per SDK docs)
 *   Cancel:  POST {base}/requests/{id}/cancel             (queued requests only; 400 otherwise)
 *   Upload:  POST {base}/files/generate-upload-url {content_type} → { public_url, upload_url, upload_headers? }
 *            then PUT bytes to upload_url
 *   Applications used here (documented in the SDKs):
 *     /v1/image2video/dop   { model: dop-lite|dop-turbo|dop-standard, prompt, input_images:[{type:"image_url",image_url}], seed?, enhance_prompt? }
 *     /v1/text2image/soul   { prompt, width_and_height, quality: 720p|1080p, batch_size: 1|4, image_reference?, seed?, enhance_prompt? }
 *
 * Unlike the official SDK's subscribe(), billable POSTs are NEVER retried automatically: the SDK
 * retries on timeouts/5xx, which can create (and bill) a duplicate generation.
 */

export type HiggsfieldStatus = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";

export interface HiggsfieldResponse {
  request_id?: string;
  status?: HiggsfieldStatus;
  status_url?: string;
  cancel_url?: string;
  images?: { url: string }[];
  video?: { url: string };
  detail?: unknown;
}

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...a) => fetch(...a);
/** Test hook: replace the HTTP transport. */
export function setHiggsfieldFetch(f: FetchLike | null) {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

const CONNECT_ERRORS = /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|CERT|certificate/i;

function authHeader() {
  const c = config.higgsfield.credentials;
  if (!c) throw new ProviderError("Higgsfield API credentials are not configured. Set HF_KEY=KEY_ID:KEY_SECRET (from https://cloud.higgsfield.ai) in .env.local.");
  return `Key ${c}`;
}

function describe(status: number, body: string) {
  let detail = body.slice(0, 400);
  try {
    const j = JSON.parse(body);
    detail = typeof j.detail === "string" ? j.detail : j.detail ? JSON.stringify(j.detail).slice(0, 400) : j.message ?? detail;
  } catch {
    /* not JSON */
  }
  const hint =
    status === 401
      ? " — the API key/secret was rejected. Check HF_KEY (format KEY_ID:KEY_SECRET from cloud.higgsfield.ai)"
      : status === 402 || status === 403
        ? " — not enough API credits on your Higgsfield Cloud balance (the API balance is separate from app subscription credits)"
        : status === 422 || status === 400
          ? " — the request parameters were rejected"
          : status === 429
            ? " — rate limited; wait and try again (nothing was submitted)"
            : "";
  return `Higgsfield API error ${status}${hint}: ${redact(detail)}`;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, opts: { billable?: boolean; timeoutMs?: number } = {}): Promise<T> {
  const url = /^https:\/\//.test(path) ? path : `${config.higgsfield.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!url.startsWith(config.higgsfield.baseUrl)) throw new ProviderError("Refusing to send credentials to a non-Higgsfield host.");
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
  } catch (e) {
    const msg = redact((e as Error)?.message ?? e);
    const cause = redact((e as { cause?: { code?: string } })?.cause?.code ?? "");
    if (opts.billable && !CONNECT_ERRORS.test(`${msg} ${cause}`)) {
      throw new UnknownOutcomeError(`Higgsfield did not respond (${msg}${cause ? `: ${cause}` : ""}). The generation may or may not have been created.`);
    }
    throw new ProviderError(`Could not reach Higgsfield: ${msg}${cause ? ` (${cause})` : ""}`);
  }
  const text = await res.text();
  if (!res.ok) {
    if (opts.billable && res.status >= 500) throw new UnknownOutcomeError(`${describe(res.status, text)}. The generation may or may not have been created.`);
    throw new ProviderError(describe(res.status, text), res.status);
  }
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    if (opts.billable) throw new UnknownOutcomeError("Higgsfield returned an unreadable response to a generation request.");
    throw new ProviderError("Higgsfield returned an unreadable response.");
  }
}

export const higgsfield = {
  /** Submit one generation. Billable: never retried. */
  async submit(application: string, args: Record<string, unknown>, webhookUrl?: string | null): Promise<HiggsfieldResponse> {
    if (!/^\/?[a-z0-9][a-z0-9/._-]*$/i.test(application) || application.includes("..")) throw new ProviderError(`Invalid Higgsfield application path "${application}".`);
    const path = `/${application.replace(/^\//, "")}${webhookUrl ? `?hf_webhook=${encodeURIComponent(webhookUrl)}` : ""}`;
    const r = await request<HiggsfieldResponse>("POST", path, args, { billable: true, timeoutMs: 60_000 });
    if (!r.request_id) throw new UnknownOutcomeError("Higgsfield accepted the request but returned no request_id.");
    return r;
  },
  status: (requestId: string) => request<HiggsfieldResponse>("GET", `/requests/${encodeURIComponent(requestId)}/status`),
  cancel: (requestId: string) => request<unknown>("POST", `/requests/${encodeURIComponent(requestId)}/cancel`),
  /** Upload a local image to Higgsfield's CDN so it can be used as input_images / image_reference. */
  async uploadFile(file: string, contentType: string): Promise<string> {
    const slot = await request<{ public_url: string; upload_url: string; upload_headers?: Record<string, string> }>("POST", "/files/generate-upload-url", { content_type: contentType });
    if (!slot.public_url || !slot.upload_url) throw new ProviderError("Higgsfield did not return an upload URL.");
    const res = await fetchImpl(slot.upload_url, { method: "PUT", body: fs.readFileSync(file), headers: slot.upload_headers ?? { "Content-Type": contentType }, signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new ProviderError(`Uploading the image to Higgsfield failed (${res.status}).`);
    return slot.public_url;
  },
};

/** Download a generated asset with type and size checks (credentials are never sent). */
export async function downloadHiggsfieldAsset(url: string, dest: string, expect: "video" | "image") {
  if (!/^https:\/\//.test(url)) throw new ProviderError("Refusing to download a non-HTTPS asset URL.");
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok || !res.body) throw new ProviderError(`Download failed (${res.status}) for generated ${expect}.`);
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.startsWith(expect) && !type.includes("octet-stream") && !type.includes("binary")) throw new ProviderError(`Unexpected content type "${type}" for generated ${expect}.`);
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
