import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { higgsfield } from "@/lib/providers/higgsfield";
import { luma } from "@/lib/providers/luma";
import { capabilities } from "@/lib/settings";
import { redact } from "@/lib/log";

/**
 * Free credential checks (no generation is created):
 * - Higgsfield: GET /requests/{dummy}/status — 401 means the key is rejected; any other answer means it was accepted.
 * - Luma: GET /credits — returns the API balance.
 */
export const POST = route(async (req) => {
  const { provider } = z.object({ provider: z.enum(["higgsfield", "luma"]) }).parse(await readJson(req));
  const caps = capabilities();
  if (provider === "higgsfield") {
    if (!caps.higgsfield) return { ok: false, message: "HF_KEY is not set (or DEMO_MODE=true)." };
    try {
      await higgsfield.status("00000000-0000-0000-0000-000000000000");
      return { ok: true, message: "Credentials accepted." };
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) return { ok: false, message: "Higgsfield rejected the credentials (401). Check HF_KEY=KEY_ID:KEY_SECRET." };
      if (status && status !== 401) return { ok: true, message: `Credentials accepted (dummy request lookup returned ${status}, as expected). Your API balance is shown on cloud.higgsfield.ai.` };
      return { ok: false, message: redact(e) };
    }
  }
  if (!caps.luma) return { ok: false, message: "LUMA_API_KEY is not set (or DEMO_MODE=true)." };
  try {
    const c = await luma.credits();
    return { ok: true, message: `Connected. Luma API balance: $${(c.credit_balance / 100).toFixed(2)}.` };
  } catch (e) {
    return { ok: false, message: redact(e) };
  }
});
