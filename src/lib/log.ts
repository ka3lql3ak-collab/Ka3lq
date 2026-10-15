import { secretValues } from "./config";

/** Remove any configured secret (and bearer tokens) from a string. */
export function redact(input: unknown): string {
  let s = typeof input === "string" ? input : input instanceof Error ? input.message : safeJson(input);
  for (const secret of secretValues()) s = s.split(secret).join("[REDACTED]");
  return s.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]").replace(/(x-api-key["':\s]+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]");
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const log = {
  info: (msg: string, extra?: unknown) => console.log(`[studio] ${redact(msg)}${extra !== undefined ? " " + redact(extra) : ""}`),
  warn: (msg: string, extra?: unknown) => console.warn(`[studio] ${redact(msg)}${extra !== undefined ? " " + redact(extra) : ""}`),
  error: (msg: string, extra?: unknown) => console.error(`[studio] ${redact(msg)}${extra !== undefined ? " " + redact(extra) : ""}`),
};
