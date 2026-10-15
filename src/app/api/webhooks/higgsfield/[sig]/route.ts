import { NextResponse } from "next/server";
import { verifyPath } from "@/lib/public-url";
import { nudgeByProviderJobId } from "@/lib/generations";
import { ensureWorker } from "@/lib/worker-start";

/**
 * Higgsfield hf_webhook callback. The body is untrusted: only the request id is read, then the
 * real status is fetched from Higgsfield's API by the poller.
 */
export async function POST(req: Request, ctx: { params: Promise<{ sig: string }> }) {
  ensureWorker();
  const { sig } = await ctx.params;
  if (!verifyPath("higgsfield-webhook", sig)) return new NextResponse("Forbidden", { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { request_id?: unknown; id?: unknown };
  const id = typeof body.request_id === "string" ? body.request_id : typeof body.id === "string" ? body.id : null;
  if (id && /^[A-Za-z0-9-]{8,64}$/.test(id)) await nudgeByProviderJobId(id).catch(() => {});
  return NextResponse.json({ ok: true });
}
