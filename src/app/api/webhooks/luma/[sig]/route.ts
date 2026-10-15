import { NextResponse } from "next/server";
import { verifyPath } from "@/lib/public-url";
import { nudgeByProviderJobId } from "@/lib/generations";
import { ensureWorker } from "@/lib/worker-start";

/**
 * Luma callback. The body is untrusted: we only take the generation id from it and then
 * fetch the real status from Luma's API ourselves.
 */
export async function POST(req: Request, ctx: { params: Promise<{ sig: string }> }) {
  ensureWorker();
  const { sig } = await ctx.params;
  if (!verifyPath("luma-webhook", sig)) return new NextResponse("Forbidden", { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (typeof body.id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.id)) await nudgeByProviderJobId(body.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
