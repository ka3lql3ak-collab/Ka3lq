"use client";
import { ApiError, api, money } from "./client";

interface PaymentDetails {
  estimate: number;
  blocked?: boolean;
  provider?: string;
  model?: string;
  budget?: { reasons: string[]; projectSpent: number; monthSpent: number; sceneSpent: number; limits: { perSceneUsd: number; perProjectUsd: number; monthlyUsd: number } };
}

type Confirm = (o: { title: string; body?: React.ReactNode; confirmLabel?: string; tone?: "danger" | "paid" | "default" }) => Promise<boolean>;

/**
 * Call an endpoint that may require paying. The server answers 402 with the estimate;
 * we show it, and only re-send with confirmCost + the exact estimate after the user agrees.
 */
export async function callPaid<T>(url: string, body: Record<string, unknown>, confirm: Confirm, what: string): Promise<T | null> {
  try {
    return await api<T>(url, { body });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 402) throw e;
    const d = (e.body as { details?: PaymentDetails })?.details;
    if (!d) throw e;
    if (d.blocked) throw new Error(`Budget limit: ${e.message}`);
    const ok = await confirm({
      title: `Confirm paid generation · ${money(d.estimate)}`,
      tone: "paid",
      confirmLabel: `Spend ~${money(d.estimate)}`,
      body: (
        <div className="space-y-3">
          <p>
            {what} will be sent to <b>{d.provider ?? "the provider"}</b>
            {d.model ? ` (${d.model})` : ""}. Estimated cost: <b className="text-white">{money(d.estimate)}</b>.
          </p>
          {d.budget && (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-ink-950/60 p-3 text-xs">
              <div>
                <div className="text-ink-500">Scene</div>
                {money(d.budget.sceneSpent)} / {money(d.budget.limits.perSceneUsd)}
              </div>
              <div>
                <div className="text-ink-500">Project</div>
                {money(d.budget.projectSpent)} / {money(d.budget.limits.perProjectUsd)}
              </div>
              <div>
                <div className="text-ink-500">Month</div>
                {money(d.budget.monthSpent)} / {money(d.budget.limits.monthlyUsd)}
              </div>
            </div>
          )}
          {d.budget && d.budget.reasons.length > 0 && <p className="text-berry-400">{d.budget.reasons.join(" ")}</p>}
          <p className="text-xs text-ink-500">Estimates come from the editable price table in Settings; Luma prices could not be verified automatically. Failed jobs are never retried automatically.</p>
        </div>
      ),
    });
    if (!ok) return null;
    return await api<T>(url, { body: { ...body, confirmCost: true, estimate: d.estimate } });
  }
}
