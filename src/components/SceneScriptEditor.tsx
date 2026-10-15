"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Field, useToast, cx } from "./ui";

export interface SceneData {
  id: string;
  idx: number;
  beat: string;
  durationSec: number;
  visual: string;
  camera: string;
  characters: string[];
  action: string;
  emotion: string;
  dialogue: { speaker: string; text: string }[];
  narration: string;
  sfx: string[];
  caption: string;
}

const SFX = ["whoosh", "pop", "boing", "sparkle", "chime", "thud", "tick", "heartbeat", "rumble", "squeak", "rain", "wind", "chirp", "ding", "wahwah", "drumroll", "magic"];
const BEATS = ["hook", "setup", "conflict", "turn", "payoff", "button"];

export function SceneScriptEditor({
  projectId,
  scene,
  cast,
  onChanged,
  onMove,
  onDelete,
  first,
  last,
  locked,
}: {
  projectId: string;
  scene: SceneData;
  cast: string[];
  onChanged: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  first: boolean;
  last: boolean;
  locked?: boolean;
}) {
  const [s, setS] = useState(scene);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!dirty) setS(scene);
  }, [scene, dirty]);

  const set = <K extends keyof SceneData>(k: K, v: SceneData[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  async function save() {
    setSaving(true);
    try {
      const { id: _id, idx: _idx, ...data } = s;
      await api(`/api/projects/${projectId}/scenes/${scene.id}`, { method: "PATCH", body: { data } });
      setDirty(false);
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }
  const speakers = ["Narrator", ...cast];
  const words = [s.narration, ...s.dialogue.map((d) => d.text)].join(" ").split(/\s+/).filter(Boolean).length;
  const speechSec = words / 2.6;
  return (
    <div className={cx("rounded-2xl border bg-ink-900/70 p-5", dirty ? "border-peach-500/50" : "border-ink-700/70")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 font-display text-sm font-bold text-white">{scene.idx + 1}</span>
        <select value={s.beat} onChange={(e) => set("beat", e.target.value)} className="w-auto py-1 text-xs" disabled={locked} aria-label="Beat">
          {BEATS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-xs text-ink-400">
          <input type="number" step={0.5} min={2} max={9} value={s.durationSec} onChange={(e) => set("durationSec", Number(e.target.value))} className="w-20 py-1" disabled={locked} aria-label="Duration seconds" />s
        </div>
        {speechSec > s.durationSec - 0.3 && <Badge tone="unknown">speech ≈{speechSec.toFixed(1)}s — too long</Badge>}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={first || locked} onClick={() => onMove(-1)} aria-label="Move up">↑</Button>
          <Button size="sm" variant="ghost" disabled={last || locked} onClick={() => onMove(1)} aria-label="Move down">↓</Button>
          <Button size="sm" variant="ghost" className="hover:text-berry-400" disabled={locked} onClick={onDelete}>Delete</Button>
          {dirty && (
            <Button size="sm" variant="primary" loading={saving} onClick={save}>Save</Button>
          )}
        </div>
      </div>
      <fieldset disabled={locked} className="grid gap-4 lg:grid-cols-2">
        <Field label="Visual description (video prompt)" className="lg:col-span-2">
          <textarea rows={3} value={s.visual} onChange={(e) => set("visual", e.target.value)} />
        </Field>
        <Field label="Camera">
          <input value={s.camera} onChange={(e) => set("camera", e.target.value)} />
        </Field>
        <Field label="Action & emotion">
          <div className="flex gap-2">
            <input value={s.action} onChange={(e) => set("action", e.target.value)} placeholder="Action" />
            <input value={s.emotion} onChange={(e) => set("emotion", e.target.value)} placeholder="Emotion" className="max-w-[9rem]" />
          </div>
        </Field>
        <Field label="Characters in shot">
          <div className="flex flex-wrap gap-1.5">
            {cast.map((c) => {
              const on = s.characters.includes(c);
              return (
                <button type="button" key={c} onClick={() => set("characters", on ? s.characters.filter((x) => x !== c) : [...s.characters, c])} className={cx("rounded-full border px-2.5 py-1 text-xs", on ? "border-peach-500 bg-peach-500/15 text-peach-400" : "border-ink-700 text-ink-400")}>
                  {c}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Sound effects (built-in, royalty-free)">
          <div className="flex flex-wrap gap-1.5">
            {SFX.map((c) => {
              const on = s.sfx.includes(c);
              return (
                <button type="button" key={c} onClick={() => set("sfx", on ? s.sfx.filter((x) => x !== c) : [...s.sfx, c].slice(0, 6))} className={cx("rounded-full border px-2 py-0.5 text-[11px]", on ? "border-sky-400 bg-sky-400/15 text-sky-300" : "border-ink-700 text-ink-500")}>
                  {c}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Narration">
          <textarea rows={2} value={s.narration} onChange={(e) => set("narration", e.target.value)} />
        </Field>
        <Field label="Caption (on-screen text)">
          <input value={s.caption} maxLength={160} onChange={(e) => set("caption", e.target.value)} />
        </Field>
        <Field label="Dialogue" className="lg:col-span-2">
          <div className="space-y-2">
            {s.dialogue.map((d, i) => (
              <div key={i} className="flex gap-2">
                <select value={d.speaker} onChange={(e) => set("dialogue", s.dialogue.map((x, j) => (j === i ? { ...x, speaker: e.target.value } : x)))} className="max-w-[10rem]" aria-label="Speaker">
                  {[...new Set([...speakers, d.speaker])].map((sp) => (
                    <option key={sp}>{sp}</option>
                  ))}
                </select>
                <input value={d.text} onChange={(e) => set("dialogue", s.dialogue.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <Button type="button" size="sm" variant="ghost" onClick={() => set("dialogue", s.dialogue.filter((_, j) => j !== i))} aria-label="Remove line">✕</Button>
              </div>
            ))}
            {s.dialogue.length < 6 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => set("dialogue", [...s.dialogue, { speaker: cast[0] ?? "Narrator", text: "" }])}>+ Add line</Button>
            )}
          </div>
        </Field>
      </fieldset>
    </div>
  );
}
