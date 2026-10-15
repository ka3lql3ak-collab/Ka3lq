import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { redact, log } from "./log";
import { ensureWorker } from "./worker-start";

type Ctx<P> = { params: Promise<P> };

/** Wrap a route handler with consistent JSON errors and secret redaction. */
export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    ensureWorker();
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const out = await fn(req, params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  const status = (e as { status?: number })?.status;
  const details = (e as { details?: unknown })?.details;
  if (status && status >= 400 && status < 500) return NextResponse.json({ error: redact(e), details }, { status });
  log.error("request failed", e instanceof Error ? e.stack ?? e.message : e);
  return NextResponse.json({ error: redact(e) || "Internal error" }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
