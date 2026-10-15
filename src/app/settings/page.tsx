"use client";
import { useEffect, useState } from "react";
import { api, money, useApi, ago } from "@/lib/client";
import { Badge, Button, Card, ErrorBox, Field, Notice, PageHeader, Tabs, useToast, cx } from "@/components/ui";
import { providerLabel } from "@/lib/labels";

interface Settings {
  budget: { perSceneUsd: number; perProjectUsd: number; monthlyUsd: number };
  prices: {
    video: Record<string, Record<string, number>>;
    ninesMultiplier: number;
    image: Record<string, number>;
    storyLlm: number;
    higgsfield: { video: Record<string, number>; image: Record<string, number> };
  };
  video: { provider: "higgsfield" | "luma" | "manual"; higgsfieldModel: string; model: string; resolution: string; duration: string };
  image: { provider: "sketch" | "higgsfield" | "luma"; model: string; higgsfieldQuality: string };
  render: { transition: string; transitionSec: number; captions: boolean; captionSize: number; musicVolume: number; sfxVolume: number; voiceVolume: number; fadeInOut: boolean };
}
interface Status {
  capabilities: { demoMode: boolean; forceDemo: boolean; higgsfield: boolean; luma: boolean; anthropic: boolean; openaiCompat: boolean; piper: boolean; flite: boolean; ffmpeg: boolean; publicBaseUrl: boolean };
}
interface Costs {
  month: number;
  allTime: number;
  byProvider: { provider: string; n: number; total: number }[];
  ledger: { id: string; provider: string; kind: string; estimated: number; actual: number | null; note: string | null; created_at: number; project_title: string | null }[];
}

export default function SettingsPage() {
  const { data, reload } = useApi<{ settings: Settings }>("/api/settings");
  const { data: status } = useApi<Status>("/api/status");
  const { data: costs } = useApi<Costs>("/api/costs");
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<"providers" | "budget" | "prices" | "render" | "spend">("providers");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<Record<string, { ok: boolean; message: string } | "busy">>({});
  const toast = useToast();
  useEffect(() => {
    if (data && !s) setS(data.settings);
  }, [data, s]);
  if (!s) return <div className="shimmer mx-auto h-96 max-w-5xl rounded-2xl" />;
  const caps = status?.capabilities;
  const dirty = JSON.stringify(s) !== JSON.stringify(data?.settings);

  const upd = <K extends keyof Settings>(k: K, v: Partial<Settings[K]>) => setS({ ...s, [k]: { ...s[k], ...v } });
  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ settings: Settings }>("/api/settings", { method: "PUT", body: s });
      setS(r.settings);
      await reload();
      toast("Settings saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function runCheck(provider: "higgsfield" | "luma") {
    setCheck((c) => ({ ...c, [provider]: "busy" }));
    try {
      const r = await api<{ ok: boolean; message: string }>("/api/providers/check", { body: { provider } });
      setCheck((c) => ({ ...c, [provider]: r }));
    } catch (e) {
      setCheck((c) => ({ ...c, [provider]: { ok: false, message: (e as Error).message } }));
    }
  }
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Cost & API settings"
        title="Providers, budgets and prices"
        subtitle="API keys live only in your server's .env.local — never in the browser. Nothing paid runs without a cost estimate and your confirmation."
        actions={<Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>Save settings</Button>}
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "providers", label: "Providers" },
            { value: "budget", label: "Budgets" },
            { value: "prices", label: "Prices" },
            { value: "render", label: "Render defaults" },
            { value: "spend", label: "Spend log" },
          ]}
        />
      </div>
      <ErrorBox error={error} className="mb-4" />

      {tab === "providers" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 font-display text-lg font-semibold text-white">Video provider</div>
            <div className="grid gap-3 md:grid-cols-3">
              {(
                [
                  ["higgsfield", "Higgsfield (preferred)", caps?.higgsfield ? "API configured" : "API not configured", caps?.higgsfield],
                  ["manual", "Manual import", "Generate in any app (e.g. Higgsfield web), import MP4s", true],
                  ["luma", "Luma (optional)", caps?.luma ? "API configured" : "Needs LUMA_API_KEY", caps?.luma],
                ] as const
              ).map(([v, name, desc, ok]) => (
                <button key={v} onClick={() => upd("video", { provider: v })} className={cx("rounded-xl border p-4 text-left transition", s.video.provider === v ? "border-peach-500 bg-peach-500/10" : "border-ink-700 hover:border-ink-500")}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{name}</span>
                    <span className={ok ? "text-lime-400" : "text-amber-300"}>{ok ? "●" : "○"}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-400">{desc}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-500">The chosen provider is never swapped for another paid provider automatically. If it isn&apos;t configured, you get free labelled demo placeholders and the manual-import workflow.</p>
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-lg font-semibold text-white">Higgsfield Cloud API</div>
              <div className="flex items-center gap-2">
                {caps?.higgsfield ? <Badge tone="approved">HF_KEY set</Badge> : <Badge tone="awaiting_approval">not configured</Badge>}
                <Button size="sm" onClick={() => runCheck("higgsfield")} loading={check.higgsfield === "busy"} disabled={!caps?.higgsfield}>Check credentials (free)</Button>
              </div>
            </div>
            {check.higgsfield && check.higgsfield !== "busy" && <Notice tone={check.higgsfield.ok ? "ok" : "warn"} className="my-2">{check.higgsfield.message}</Notice>}
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-300">
              <li>
                Sign in at <b>cloud.higgsfield.ai</b> (Higgsfield&apos;s developer console). The API is billed from a <b>separate pay-as-you-go API balance</b>, not your app subscription credits. Higgsfield&apos;s blog mentions a $5 minimum top-up; confirm on the console.
              </li>
              <li>Create an API key. You get a <b>Key ID</b> and a <b>Key Secret</b> (the secret is shown once).</li>
              <li>
                Add to <code className="rounded bg-ink-800 px-1">.env.local</code>: <code className="rounded bg-ink-800 px-1">HF_KEY=KEY_ID:KEY_SECRET</code>, then restart the app.
              </li>
              <li>Click “Check credentials”. It calls a free status endpoint and never creates a generation.</li>
            </ol>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Clip model (image-to-video)" hint="DoP animates a keyframe image. Clip length is set by Higgsfield.">
                <select value={s.video.higgsfieldModel} onChange={(e) => upd("video", { higgsfieldModel: e.target.value })}>
                  <option value="dop-lite">DoP Lite — basic speed & quality</option>
                  <option value="dop-turbo">DoP Turbo — 2× speed, priority queue</option>
                  <option value="dop-standard">DoP Standard — highest quality</option>
                </select>
              </Field>
              <Field label="Keyframe & reference images" hint="Higgsfield Soul, 9:16 (1152×2048), reusing the approved character reference">
                <select value={s.image.higgsfieldQuality} onChange={(e) => upd("image", { higgsfieldQuality: e.target.value })}>
                  <option value="1080p">Soul 1080p</option>
                  <option value="720p">Soul 720p (cheaper)</option>
                </select>
              </Field>
            </div>
            <Notice tone="info" className="mt-4 text-xs">
              Integration built from Higgsfield&apos;s official SDKs (@higgsfield/client 0.2.6, higgsfield-client 0.2.0): <code>Authorization: Key id:secret</code>, POST <code>/v1/text2image/soul</code> and <code>/v1/image2video/dop</code>, GET <code>/requests/&#123;id&#125;/status</code>, POST <code>/requests/&#123;id&#125;/cancel</code> (queued only), uploads via <code>/files/generate-upload-url</code>. Unlike the SDK, generation requests are never retried automatically, which prevents duplicate charges. Other models in the Higgsfield app (Kling, Seedance, …) aren&apos;t wired in because their API paths couldn&apos;t be verified. Use the manual-import workflow for those.
            </Notice>
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-lg font-semibold text-white">Luma (optional)</div>
              <div className="flex items-center gap-2">
                {caps?.luma ? <Badge tone="approved">LUMA_API_KEY set</Badge> : <Badge tone="pending">not configured</Badge>}
                <Button size="sm" onClick={() => runCheck("luma")} loading={check.luma === "busy"} disabled={!caps?.luma}>Check (free)</Button>
              </div>
            </div>
            {check.luma && check.luma !== "busy" && <Notice tone={check.luma.ok ? "ok" : "warn"} className="my-2">{check.luma.message}</Notice>}
            <p className="text-sm text-ink-400">Only used if you pick Luma above. Ray 2 / Ray Flash 2 video, Photon keyframes.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Model">
                <select value={s.video.model} onChange={(e) => upd("video", { model: e.target.value })}>
                  <option value="ray-flash-2">Ray Flash 2</option>
                  <option value="ray-2">Ray 2</option>
                </select>
              </Field>
              <Field label="Resolution">
                <select value={s.video.resolution} onChange={(e) => upd("video", { resolution: e.target.value })}>
                  {["540p", "720p", "1080p", "4k"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Clip length">
                <select value={s.video.duration} onChange={(e) => upd("video", { duration: e.target.value })}>
                  <option value="auto">Auto (5s or 9s per scene)</option>
                  <option value="5s">Always 5s</option>
                  <option value="9s">Always 9s</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 font-display text-lg font-semibold text-white">Other services</div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["FFmpeg rendering", caps?.ffmpeg, "Required, free"],
                ["Local voices (flite)", caps?.flite, "Free, built into FFmpeg"],
                ["Piper voices", caps?.piper, "Optional: PIPER_BIN + PIPER_VOICES_DIR"],
                ["Anthropic story writer", caps?.anthropic, "Optional: ANTHROPIC_API_KEY (paid)"],
                ["Ollama / OpenAI-compatible", caps?.openaiCompat, "Optional: OPENAI_COMPAT_BASE_URL + MODEL"],
                ["Public URL / webhooks", caps?.publicBaseUrl, "Optional: PUBLIC_BASE_URL (polling works without)"],
              ].map(([n, ok, d]) => (
                <div key={String(n)} className="flex items-start gap-2 rounded-lg bg-ink-950/40 p-3">
                  <span className={ok ? "text-lime-400" : "text-ink-500"}>{ok ? "●" : "○"}</span>
                  <div>
                    <div className="text-ink-200">{n}</div>
                    <div className="text-xs text-ink-500">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "budget" && (
        <Card className="p-5">
          <p className="mb-4 text-sm text-ink-400">Paid requests that would push spend past any limit are blocked before anything is sent. Committed spend counts actual cost where the provider reports it and the estimate otherwise. Unconfirmed (“unknown”) submissions count until you dismiss them.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Per scene (USD)"><input type="number" min={0} step={0.5} value={s.budget.perSceneUsd} onChange={(e) => upd("budget", { perSceneUsd: num(e.target.value) })} /></Field>
            <Field label="Per project (USD)" hint="Each project can override this"><input type="number" min={0} step={1} value={s.budget.perProjectUsd} onChange={(e) => upd("budget", { perProjectUsd: num(e.target.value) })} /></Field>
            <Field label="Per month (USD)"><input type="number" min={0} step={1} value={s.budget.monthlyUsd} onChange={(e) => upd("budget", { monthlyUsd: num(e.target.value) })} /></Field>
          </div>
          {costs && <div className="mt-4 text-sm text-ink-300">This month: <b>{money(costs.month)}</b> of {money(s.budget.monthlyUsd)} · all time {money(costs.allTime)}</div>}
        </Card>
      )}

      {tab === "prices" && (
        <div className="space-y-4">
          <Notice tone="warn">
            <b>These are estimates you control.</b> Neither Higgsfield&apos;s nor Luma&apos;s pricing pages could be reached while this app was built, so defaults are conservative placeholders. Check your provider dashboard and edit them. Higgsfield&apos;s API does not report per-request cost, so Higgsfield spend is tracked by estimate. Luma spend is measured from your balance when possible.
          </Notice>
          <Card className="p-5">
            <div className="mb-3 font-semibold text-white">Higgsfield (USD per generation)</div>
            <div className="grid gap-3 sm:grid-cols-5">
              {Object.entries(s.prices.higgsfield.video).map(([k, v]) => (
                <Field key={k} label={k}><input type="number" min={0} step={0.01} value={v} onChange={(e) => setS({ ...s, prices: { ...s.prices, higgsfield: { ...s.prices.higgsfield, video: { ...s.prices.higgsfield.video, [k]: num(e.target.value) } } } })} /></Field>
              ))}
              {Object.entries(s.prices.higgsfield.image).map(([k, v]) => (
                <Field key={k} label={`Soul ${k}`}><input type="number" min={0} step={0.01} value={v} onChange={(e) => setS({ ...s, prices: { ...s.prices, higgsfield: { ...s.prices.higgsfield, image: { ...s.prices.higgsfield.image, [k]: num(e.target.value) } } } })} /></Field>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-3 font-semibold text-white">Luma (USD per 5-second clip; 9s × multiplier)</div>
            {Object.entries(s.prices.video).map(([model, res]) => (
              <div key={model} className="mb-3 grid gap-3 sm:grid-cols-5">
                <div className="self-end pb-2 text-sm text-ink-300">{model}</div>
                {Object.entries(res).map(([r, v]) => (
                  <Field key={r} label={r}><input type="number" min={0} step={0.01} value={v} onChange={(e) => setS({ ...s, prices: { ...s.prices, video: { ...s.prices.video, [model]: { ...res, [r]: num(e.target.value) } } } })} /></Field>
                ))}
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="9s multiplier"><input type="number" min={1} step={0.1} value={s.prices.ninesMultiplier} onChange={(e) => setS({ ...s, prices: { ...s.prices, ninesMultiplier: num(e.target.value) } })} /></Field>
              {Object.entries(s.prices.image).map(([k, v]) => (
                <Field key={k} label={k}><input type="number" min={0} step={0.001} value={v} onChange={(e) => setS({ ...s, prices: { ...s.prices, image: { ...s.prices.image, [k]: num(e.target.value) } } })} /></Field>
              ))}
              <Field label="Story (Anthropic)"><input type="number" min={0} step={0.01} value={s.prices.storyLlm} onChange={(e) => setS({ ...s, prices: { ...s.prices, storyLlm: num(e.target.value) } })} /></Field>
            </div>
          </Card>
        </div>
      )}

      {tab === "render" && (
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Transition">
              <select value={s.render.transition} onChange={(e) => upd("render", { transition: e.target.value })}>
                <option value="cut">Hard cut</option>
                <option value="crossfade">Crossfade</option>
                <option value="fadeblack">Dip to black</option>
              </select>
            </Field>
            <Field label={`Transition length ${s.render.transitionSec.toFixed(2)}s`}><input type="range" min={0} max={1.2} step={0.05} value={s.render.transitionSec} onChange={(e) => upd("render", { transitionSec: Number(e.target.value) })} /></Field>
            <Field label={`Caption size ${s.render.captionSize}px`}><input type="range" min={40} max={110} step={2} value={s.render.captionSize} onChange={(e) => upd("render", { captionSize: Number(e.target.value) })} /></Field>
            <Field label={`Voice volume ×${s.render.voiceVolume.toFixed(2)}`}><input type="range" min={0} max={2} step={0.05} value={s.render.voiceVolume} onChange={(e) => upd("render", { voiceVolume: Number(e.target.value) })} /></Field>
            <Field label={`SFX volume ×${s.render.sfxVolume.toFixed(2)}`}><input type="range" min={0} max={2} step={0.05} value={s.render.sfxVolume} onChange={(e) => upd("render", { sfxVolume: Number(e.target.value) })} /></Field>
            <Field label={`Music volume ×${s.render.musicVolume.toFixed(2)}`}><input type="range" min={0} max={1} step={0.02} value={s.render.musicVolume} onChange={(e) => upd("render", { musicVolume: Number(e.target.value) })} /></Field>
            <label className="flex items-center gap-2 normal-case tracking-normal"><input type="checkbox" checked={s.render.captions} onChange={(e) => upd("render", { captions: e.target.checked })} /> Burn in captions</label>
            <label className="flex items-center gap-2 normal-case tracking-normal"><input type="checkbox" checked={s.render.fadeInOut} onChange={(e) => upd("render", { fadeInOut: e.target.checked })} /> Fade in / out</label>
          </div>
        </Card>
      )}

      {tab === "spend" && (
        <Card className="p-5">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-ink-950/50 p-4"><div className="text-xs text-ink-500">This month</div><div className="font-display text-2xl font-bold text-white">{money(costs?.month)}</div></div>
            <div className="rounded-xl bg-ink-950/50 p-4"><div className="text-xs text-ink-500">All time</div><div className="font-display text-2xl font-bold text-white">{money(costs?.allTime)}</div></div>
            <div className="rounded-xl bg-ink-950/50 p-4 text-xs text-ink-400">
              {costs?.byProvider.map((p) => (
                <div key={p.provider}>{providerLabel(p.provider)}: {p.n} jobs · {money(p.total)}</div>
              ))}
              {costs?.byProvider.length === 0 && "No paid jobs yet."}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-500">
                <tr><th className="py-2">When</th><th>Project</th><th>Provider</th><th>Kind</th><th>Estimated</th><th>Actual</th><th>Note</th></tr>
              </thead>
              <tbody>
                {costs?.ledger.map((l) => (
                  <tr key={l.id} className="border-t border-ink-800 text-ink-300">
                    <td className="py-2">{ago(l.created_at)}</td>
                    <td>{l.project_title ?? "—"}</td>
                    <td>{providerLabel(l.provider)}</td>
                    <td>{l.kind}</td>
                    <td>{money(l.estimated)}</td>
                    <td>{l.actual === null ? "—" : money(l.actual)}</td>
                    <td className="text-ink-500">{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {costs?.ledger.length === 0 && <div className="py-6 text-center text-sm text-ink-500">Nothing spent yet.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
