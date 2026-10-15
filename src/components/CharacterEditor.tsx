"use client";
import { useRef, useState } from "react";
import { api, useApi } from "@/lib/client";
import { callPaid } from "@/lib/paid";
import { rid } from "@/lib/rid";
import { Badge, Button, ErrorBox, Field, Notice, Spinner, useConfirm, useToast, cx } from "./ui";
import type { CharacterView } from "./ProjectContext";

interface Asset {
  id: string;
  url: string;
  provider: string;
  approval: "pending" | "approved" | "rejected";
  isDemo: boolean;
  createdAt: number;
}
interface Gen {
  id: string;
  status: string;
  error: string | null;
  provider: string;
  estimatedCost: number;
}
interface Detail {
  character: CharacterView;
  images: Asset[];
  generations: Gen[];
  projects: { id: string; title: string }[];
}

const FLITE = [
  ["slt", "Female (slt)"],
  ["kal16", "Male (kal16)"],
  ["kal", "Male, robotic (kal)"],
  ["awb", "Male, Scottish (awb)"],
  ["rms", "Male, deep (rms)"],
];

export function CharacterEditor({ id, onSaved, lumaReady }: { id: string; onSaved?: () => void; lumaReady?: boolean }) {
  const { data, reload, error } = useApi<Detail>(`/api/characters/${id}`, (d) => (d?.generations.some((g) => ["queued", "submitting", "submitted", "generating"].includes(g.status)) ? 2000 : false));
  const [draft, setDraft] = useState<CharacterView | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const c = draft ?? data?.character;
  if (!c) return error ? <ErrorBox error={error} /> : <div className="shimmer h-80 rounded-xl" />;
  const set = <K extends keyof CharacterView>(k: K, v: CharacterView[K]) => setDraft({ ...c, [k]: v });
  const setVoice = (k: keyof CharacterView["voice"], v: string | number) => setDraft({ ...c, voice: { ...c.voice, [k]: v } });

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    try {
      const { id: _i, approvedImageId: _a, approvedImageUrl: _u, ...body } = draft as CharacterView & Record<string, unknown>;
      delete (body as Record<string, unknown>).createdAt;
      delete (body as Record<string, unknown>).updatedAt;
      await api(`/api/characters/${id}`, { method: "PATCH", body });
      setDraft(null);
      toast("Character saved");
      reload();
      onSaved?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function generate(providerId: "sketch" | "luma-image") {
    setBusy(providerId);
    setErr(null);
    try {
      if (draft) await save();
      await callPaid(`/api/characters/${id}/reference`, { providerId, requestId: rid() }, confirm, `A reference image of ${c!.name}`);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function act(assetId: string, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !(await confirm({ title: "Delete this image?", confirmLabel: "Delete", tone: "danger" }))) return;
    await api(`/api/characters/${id}/images`, { method: "PATCH", body: { assetId, action } });
    reload();
    onSaved?.();
  }
  async function upload(f: File) {
    const form = new FormData();
    form.set("file", f);
    setBusy("upload");
    try {
      await api(`/api/characters/${id}/images`, { form });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function previewVoice() {
    setBusy("voice");
    setErr(null);
    try {
      const r = await api<{ url: string }>("/api/voice/preview", { body: { voice: c!.voice, text: `Hi! I'm ${c!.name}. Nice to meet you!` } });
      setPreviewUrl(`${r.url}?t=${Date.now()}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const pending = data?.generations.filter((g) => ["queued", "submitting", "submitted", "generating"].includes(g.status)) ?? [];
  const failed = data?.generations.find((g) => g.status === "failed");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-semibold text-white">Reference images</div>
          {c.approvedImageId ? <Badge tone="approved">Reference approved</Badge> : <Badge tone="awaiting_approval">Needs approval</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {data?.images.map((a) => (
            <div key={a.id} className={cx("group relative overflow-hidden rounded-xl border", a.approval === "approved" ? "border-lime-500/70 ring-2 ring-lime-500/30" : a.approval === "rejected" ? "border-berry-500/40 opacity-50" : "border-ink-700")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={`${c.name} reference`} className="aspect-square w-full object-cover" />
              <div className="absolute left-2 top-2 flex gap-1">
                <Badge tone={a.provider === "sketch" ? "demo" : a.provider === "upload" ? "pending" : "paid"}>{a.provider === "sketch" ? "sketch" : a.provider === "upload" ? "upload" : "AI"}</Badge>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/80 p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                {a.approval !== "approved" && <Button size="sm" variant="success" onClick={() => act(a.id, "approve")}>Approve</Button>}
                {a.approval !== "rejected" && <Button size="sm" onClick={() => act(a.id, "reject")}>Reject</Button>}
                <Button size="sm" variant="danger" onClick={() => act(a.id, "delete")}>✕</Button>
              </div>
            </div>
          ))}
          {pending.map((g) => (
            <div key={g.id} className="shimmer flex aspect-square items-center justify-center rounded-xl text-xs text-ink-300">
              <Spinner /> &nbsp;{g.status}
            </div>
          ))}
        </div>
        {failed && <ErrorBox error={`Last generation failed: ${failed.error}`} />}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => generate("sketch")} loading={busy === "sketch"}>Sketch reference (free)</Button>
          <Button variant="primary" onClick={() => generate("luma-image")} loading={busy === "luma-image"} disabled={!lumaReady} title={lumaReady ? "" : "Requires LUMA_API_KEY"}>
            AI reference · Luma Photon
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()} loading={busy === "upload"}>Upload image</Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <Notice tone="info" className="text-xs">
          The approved image is reused as the identity reference for every AI storyboard frame this character appears in. Sketches are planning aids and are never sent to AI models. AI models can still drift — review every clip.
        </Notice>
        {data && data.projects.length > 0 && <div className="text-xs text-ink-500">Used in: {data.projects.map((p) => p.title).join(", ")}</div>}
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input value={c.name} onChange={(e) => set("name", e.target.value)} maxLength={40} /></Field>
          <Field label="Fruit"><input value={c.fruit} onChange={(e) => set("fruit", e.target.value)} maxLength={40} /></Field>
          <Field label="Appearance (canonical description)" className="sm:col-span-2">
            <textarea rows={4} value={c.appearance} onChange={(e) => set("appearance", e.target.value)} />
          </Field>
          <Field label="Body shape"><input value={c.bodyShape} onChange={(e) => set("bodyShape", e.target.value)} /></Field>
          <Field label="Face"><input value={c.face} onChange={(e) => set("face", e.target.value)} /></Field>
          <Field label="Eyes"><input value={c.eyes} onChange={(e) => set("eyes", e.target.value)} /></Field>
          <Field label="Mouth"><input value={c.mouth} onChange={(e) => set("mouth", e.target.value)} /></Field>
          <Field label="Limbs"><input value={c.limbs} onChange={(e) => set("limbs", e.target.value)} /></Field>
          <Field label="Clothing"><input value={c.clothing} onChange={(e) => set("clothing", e.target.value)} /></Field>
          <Field label="Accessories"><input value={c.accessories} onChange={(e) => set("accessories", e.target.value)} /></Field>
          <Field label="Personality"><input value={c.personality} onChange={(e) => set("personality", e.target.value)} /></Field>
          <Field label="Sketch palette" className="sm:col-span-2">
            <div className="flex gap-2">
              {c.palette.map((p, i) => (
                <input key={i} type="color" value={p} onChange={(e) => set("palette", c.palette.map((x, j) => (j === i ? e.target.value : x)))} className="h-9 w-14 cursor-pointer p-1" aria-label={`Palette color ${i + 1}`} />
              ))}
            </div>
          </Field>
        </div>
        <div className="rounded-xl border border-ink-700 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-white">Voice</div>
            <Button size="sm" onClick={previewVoice} loading={busy === "voice"}>▶ Preview voice</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Engine">
              <select value={c.voice.engine} onChange={(e) => setVoice("engine", e.target.value)}>
                <option value="flite">Flite (built into FFmpeg, free)</option>
                <option value="piper">Piper (local, free, needs setup)</option>
                <option value="recorded">Record / import my own</option>
              </select>
            </Field>
            <Field label="Voice">
              {c.voice.engine === "flite" ? (
                <select value={c.voice.voice} onChange={(e) => setVoice("voice", e.target.value)}>
                  {FLITE.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              ) : (
                <input value={c.voice.voice} onChange={(e) => setVoice("voice", e.target.value)} placeholder={c.voice.engine === "piper" ? "en_US-amy-medium" : "—"} disabled={c.voice.engine === "recorded"} />
              )}
            </Field>
            <Field label={`Pitch ×${c.voice.pitch.toFixed(2)}`}><input type="range" min={0.6} max={1.9} step={0.05} value={c.voice.pitch} onChange={(e) => setVoice("pitch", Number(e.target.value))} /></Field>
            <Field label={`Speed ×${c.voice.speed.toFixed(2)}`}><input type="range" min={0.6} max={1.6} step={0.05} value={c.voice.speed} onChange={(e) => setVoice("speed", Number(e.target.value))} /></Field>
            <Field label={`Volume ×${c.voice.volume.toFixed(2)}`}><input type="range" min={0} max={2} step={0.05} value={c.voice.volume} onChange={(e) => setVoice("volume", Number(e.target.value))} /></Field>
          </div>
          {previewUrl && <audio src={previewUrl} controls autoPlay className="mt-3 w-full" />}
        </div>
        <ErrorBox error={err} />
        <div className="flex justify-end gap-2">
          {draft && <Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button>}
          <Button variant="primary" disabled={!draft} loading={saving} onClick={save}>Save character</Button>
        </div>
      </div>
    </div>
  );
}
