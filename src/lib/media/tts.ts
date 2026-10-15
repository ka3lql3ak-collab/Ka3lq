import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ffmpeg, run, probe } from "./ffmpeg";
import { config } from "../config";
import type { VoiceConfig } from "../types";

export const FLITE_VOICES = ["slt", "kal16", "kal", "awb", "rms"] as const;

/** Clean text for speech: drop emoji/markup, expand a few symbols. */
export function speakable(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[*_#`~<>]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/—|–/g, ", ")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/**
 * Synthesize one line to a 48 kHz mono WAV. flite runs inside FFmpeg (free, offline);
 * Piper is used when configured. Pitch/speed are applied with the rubberband filter so
 * pitch changes don't alter timing.
 */
export async function synthesize(text: string, voice: VoiceConfig, outWav: string): Promise<{ durationSec: number }> {
  const clean = speakable(text);
  if (!clean) throw new Error("Nothing to say: the line is empty after cleanup.");
  fs.mkdirSync(path.dirname(outWav), { recursive: true });
  const raw = outWav.replace(/\.wav$/, ".raw.wav");
  try {
    if (voice.engine === "piper") {
      const bin = config.piper.bin;
      const dir = config.piper.voicesDir;
      if (!bin || !dir) throw new Error("Piper is not configured (set PIPER_BIN and PIPER_VOICES_DIR), or switch this voice to flite.");
      if (!/^[A-Za-z0-9_.-]+$/.test(voice.voice)) throw new Error("Invalid Piper voice name.");
      const model = path.join(dir, `${voice.voice}.onnx`);
      if (!fs.existsSync(model)) throw new Error(`Piper voice not found: ${model}`);
      const r = await run(bin, ["--model", model, "--output_file", raw], { input: clean, timeoutMs: 120_000 });
      if (r.code !== 0 || !fs.existsSync(raw)) throw new Error(`Piper failed: ${r.stderr.split("\n").slice(-3).join(" ")}`);
    } else if (voice.engine === "flite") {
      const v = (FLITE_VOICES as readonly string[]).includes(voice.voice) ? voice.voice : "slt";
      const txt = outWav.replace(/\.wav$/, ".txt");
      fs.writeFileSync(txt, clean);
      try {
        // textfile= avoids any filter-graph escaping of user text.
        await ffmpeg(["-loglevel", "error", "-f", "lavfi", "-i", `flite=textfile=${escapeFilterPath(txt)}:voice=${v}`, raw], { timeoutMs: 60_000 });
      } finally {
        fs.rmSync(txt, { force: true });
      }
    } else {
      throw new Error("This character uses recorded audio. Record or import the line instead.");
    }
    const pitch = clamp(voice.pitch, 0.5, 2);
    const tempo = clamp(voice.speed, 0.5, 2);
    const vol = clamp(voice.volume, 0, 2);
    const af = [`aresample=48000`, `rubberband=pitch=${pitch.toFixed(3)}:tempo=${tempo.toFixed(3)}`, `highpass=f=70`, `volume=${vol.toFixed(2)}`, `silenceremove=start_periods=1:start_threshold=-50dB`, `areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse`, `apad=pad_dur=0.05`].join(",");
    await ffmpeg(["-loglevel", "error", "-i", raw, "-af", af, "-ac", "1", "-ar", "48000", outWav], { timeoutMs: 60_000 });
  } finally {
    fs.rmSync(raw, { force: true });
  }
  const info = await probe(outWav);
  return { durationSec: info.durationSec };
}

/** Convert any recorded/imported audio (webm, mp3, m4a…) to normalised 48 kHz mono WAV. */
export async function importVoice(src: string, outWav: string) {
  await ffmpeg(["-loglevel", "error", "-i", src, "-vn", "-af", "aresample=48000,highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse", "-ac", "1", "-ar", "48000", outWav], { timeoutMs: 120_000 });
  return { durationSec: (await probe(outWav)).durationSec };
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : 1));

/** Escape a path for use inside an FFmpeg filter option value. */
export function escapeFilterPath(p: string) {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/;/g, "\;");
}
