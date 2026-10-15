"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const d = data as { error?: string; issues?: { path: string; message: string }[] } | null;
    const issues = d?.issues?.map((i) => `${i.path ? i.path + ": " : ""}${i.message}`).join("; ");
    throw new ApiError(issues ? `${d?.error}: ${issues}` : d?.error ?? `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}

/** Fetch JSON with optional polling. `poll` may be a number or a function of the latest data. */
export function useApi<T>(url: string | null, poll?: number | ((d: T | undefined) => number | false)) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const pollRef = useRef(poll);
  pollRef.current = poll;
  const dataRef = useRef<T | undefined>(undefined);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const d = await api<T>(url);
      dataRef.current = d;
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const run = async () => {
      await load();
      if (!alive) return;
      const p = pollRef.current;
      const ms = typeof p === "function" ? p(dataRef.current) : p;
      if (ms) timer = setTimeout(run, ms);
    };
    setLoading(!!url);
    run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [load, url]);

  return { data, error, loading, reload: load, setData };
}

export const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `$${n < 0.1 && n > 0 ? n.toFixed(3) : n.toFixed(2)}`);
export const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
};
