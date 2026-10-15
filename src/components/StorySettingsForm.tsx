"use client";
import { Field } from "./ui";

export interface StorySettingsValue {
  idea: string;
  genre: string;
  durationSec: number;
  sceneCount: number;
  characterCount: number;
  dialogueStyle: string;
  narratorStyle: string;
  visualStyle: string;
  language: string;
  storyProvider: "local" | "anthropic" | "openai-compat";
}

export const DEFAULT_STORY_SETTINGS: StorySettingsValue = {
  idea: "",
  genre: "wholesome",
  durationSec: 30,
  sceneCount: 6,
  characterCount: 2,
  dialogueStyle: "playful",
  narratorStyle: "warm storyteller",
  visualStyle: "3d family film",
  language: "English",
  storyProvider: "local",
};

const SCENES_FOR: Record<number, number> = { 15: 3, 30: 6, 45: 7, 60: 9 };

export function StorySettingsForm({ value, onChange, caps }: { value: StorySettingsValue; onChange: (v: StorySettingsValue) => void; caps?: { anthropic: boolean; openaiCompat: boolean } }) {
  const set = <K extends keyof StorySettingsValue>(k: K, v: StorySettingsValue[K]) => onChange({ ...value, [k]: v });
  const avg = value.durationSec / value.sceneCount;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Story idea" className="sm:col-span-2 lg:col-span-3" hint={`${value.idea.length}/600 — one sentence is enough. Name the fruits and what happens.`}>
        <textarea rows={3} maxLength={600} value={value.idea} onChange={(e) => set("idea", e.target.value)} placeholder="A lonely strawberry finds a tiny abandoned orange and decides to help it." />
      </Field>
      <Field label="Genre">
        <select value={value.genre} onChange={(e) => set("genre", e.target.value)}>
          {["funny", "emotional", "wholesome", "adventure", "mystery", "twist"].map((g) => (
            <option key={g} value={g}>{g === "twist" ? "surprising twist" : g}</option>
          ))}
        </select>
      </Field>
      <Field label="Duration" hint="YouTube Shorts: up to 60s recommended">
        <select
          value={value.durationSec}
          onChange={(e) => {
            const d = Number(e.target.value);
            onChange({ ...value, durationSec: d, sceneCount: SCENES_FOR[d] });
          }}
        >
          {[15, 30, 45, 60].map((d) => (
            <option key={d} value={d}>{d} seconds</option>
          ))}
        </select>
      </Field>
      <Field label="Scenes" hint={avg > 9 ? "⚠ Scenes longer than 9s exceed one AI clip — add scenes" : avg < 2.5 ? "Very fast cuts" : `≈${avg.toFixed(1)}s per scene (each scene = 1 AI clip)`}>
        <input type="number" min={2} max={12} value={value.sceneCount} onChange={(e) => set("sceneCount", Math.max(2, Math.min(12, Number(e.target.value) || 2)))} />
      </Field>
      <Field label="Characters">
        <input type="number" min={1} max={4} value={value.characterCount} onChange={(e) => set("characterCount", Math.max(1, Math.min(4, Number(e.target.value) || 1)))} />
      </Field>
      <Field label="Dialogue style">
        <select value={value.dialogueStyle} onChange={(e) => set("dialogueStyle", e.target.value)}>
          {["minimal", "playful", "heartfelt", "witty", "no-dialogue"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="Narrator">
        <select value={value.narratorStyle} onChange={(e) => set("narratorStyle", e.target.value)}>
          {["none", "warm storyteller", "playful", "documentary", "dramatic trailer"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="Visual style">
        <select value={value.visualStyle} onChange={(e) => set("visualStyle", e.target.value)}>
          {["3d family film", "claymation", "storybook 3d", "glossy toy"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="Language" hint={value.storyProvider === "local" && !/^english$/i.test(value.language) ? "Local composer writes English only" : undefined}>
        <input value={value.language} onChange={(e) => set("language", e.target.value)} maxLength={40} />
      </Field>
      <Field label="Story writer" className="sm:col-span-2 lg:col-span-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["local", "Local composer", "Free · offline · template-based", true],
              ["anthropic", "Anthropic Claude", caps?.anthropic ? "Paid · ~$0.25/story estimate · richest stories" : "Needs ANTHROPIC_API_KEY", !!caps?.anthropic],
              ["openai-compat", "OpenAI-compatible / Ollama", caps?.openaiCompat ? "Free if local (Ollama)" : "Needs OPENAI_COMPAT_* settings", !!caps?.openaiCompat],
            ] as const
          ).map(([v, name, desc, enabled]) => (
            <button
              type="button"
              key={v}
              disabled={!enabled}
              onClick={() => set("storyProvider", v)}
              className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${value.storyProvider === v ? "border-peach-500 bg-peach-500/10" : "border-ink-700 bg-ink-900 hover:border-ink-500"}`}
            >
              <div className="text-sm font-semibold text-white">{name}</div>
              <div className="text-xs text-ink-400">{desc}</div>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}
