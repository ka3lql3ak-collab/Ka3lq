import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ffmpeg } from "./ffmpeg";
import { mediaDir } from "../paths";
import { SFX_NAMES, type SfxName } from "./sfx-names";

/**
 * Built-in sound effects, synthesized locally with FFmpeg (no samples, no licensing issues).
 * Each entry is an FFmpeg lavfi source plus an optional filter chain.
 */
const RECIPES: Record<SfxName, { src: string; af?: string }> = {
  pop: { src: "aevalsrc='0.9*sin(2*PI*(900-5000*t)*t)*exp(-35*t)':d=0.15" },
  boing: { src: "aevalsrc='0.7*sin(2*PI*(260+90*sin(2*PI*11*t))*t)*exp(-4.5*t)':d=0.7" },
  whoosh: { src: "anoisesrc=d=0.7:c=pink:a=0.9", af: "bandpass=f=900:width_type=h:w=900,afade=t=in:d=0.3,afade=t=out:st=0.32:d=0.38,volume=2.2" },
  sparkle: { src: "aevalsrc='0.25*sin(2*PI*2093*t)*exp(-7*t)+0.25*sin(2*PI*2637*t)*exp(-7*(t-0.07))*gte(t,0.07)+0.25*sin(2*PI*3136*t)*exp(-7*(t-0.14))*gte(t,0.14)+0.2*sin(2*PI*4186*t)*exp(-7*(t-0.21))*gte(t,0.21)':d=0.9", af: "aecho=0.6:0.5:60:0.3" },
  chime: { src: "aevalsrc='0.35*sin(2*PI*1046.5*t)*exp(-2.5*t)+0.22*sin(2*PI*1568*t)*exp(-3.2*t)+0.12*sin(2*PI*2093*t)*exp(-4*t)':d=1.4" },
  thud: { src: "aevalsrc='0.95*sin(2*PI*(95-55*t)*t)*exp(-11*t)':d=0.4", af: "lowpass=f=400" },
  tick: { src: "aevalsrc='0.6*sin(2*PI*2200*t)*exp(-180*mod(t,0.5))':d=1.0" },
  heartbeat: { src: "aevalsrc='0.9*sin(2*PI*55*t)*(exp(-28*t)+0.8*exp(-28*(t-0.22))*gte(t,0.22))':d=0.9", af: "lowpass=f=200,volume=1.8" },
  rumble: { src: "anoisesrc=d=1.4:c=brown:a=0.9", af: "lowpass=f=140,afade=t=in:d=0.3,afade=t=out:st=0.8:d=0.6,volume=2.5" },
  squeak: { src: "aevalsrc='0.5*sin(2*PI*(1500+650*sin(2*PI*7*t))*t)*exp(-7*t)':d=0.3" },
  rain: { src: "anoisesrc=d=3:c=white:a=0.5", af: "highpass=f=900,lowpass=f=7000,afade=t=in:d=0.5,afade=t=out:st=2.3:d=0.7,volume=0.6" },
  wind: { src: "anoisesrc=d=3:c=pink:a=0.8", af: "bandpass=f=450:width_type=h:w=500,tremolo=f=0.6:d=0.6,afade=t=in:d=0.8,afade=t=out:st=2:d=1" },
  chirp: { src: "aevalsrc='0.35*sin(2*PI*(2600+5000*mod(t,0.16))*t)*lt(mod(t,0.16),0.07)*exp(-25*mod(t,0.16))':d=0.6" },
  ding: { src: "aevalsrc='0.5*sin(2*PI*1760*t)*exp(-4.5*t)+0.2*sin(2*PI*3520*t)*exp(-7*t)':d=1.1" },
  wahwah: { src: "aevalsrc='0.35*sin(2*PI*(if(lt(t,0.35),311,if(lt(t,0.7),294,if(lt(t,1.05),277,262)))+5*sin(2*PI*5*t)*gte(t,1.05))*t)':d=1.7", af: "lowpass=f=1500,afade=t=out:st=1.3:d=0.4,volume=1.4" },
  drumroll: { src: "aevalsrc='(random(0)*2-1)*exp(-35*mod(t,0.045))*(0.25+0.75*t/1.5)':d=1.5", af: "highpass=f=150,lowpass=f=5000" },
  magic: { src: "aevalsrc='0.3*sin(2*PI*(500+1600*t)*t)*exp(-1.6*t)+0.2*sin(2*PI*(1000+3200*t)*t)*exp(-2.2*t)':d=1.1", af: "aecho=0.7:0.6:80:0.35" },
};

/** Path to a rendered SFX file (rendered once, then cached). */
export async function sfxFile(name: SfxName): Promise<string> {
  if (!(SFX_NAMES as readonly string[]).includes(name)) throw new Error(`Unknown sound effect "${name}"`);
  const out = path.join(mediaDir("sfx"), `${name}-v1.wav`);
  if (fs.existsSync(out)) return out;
  const r = RECIPES[name];
  const args = ["-loglevel", "error", "-f", "lavfi", "-i", r.src];
  if (r.af) args.push("-af", r.af);
  args.push("-ac", "1", "-ar", "48000", out);
  await ffmpeg(args, { timeoutMs: 30_000 });
  return out;
}

/* --------------------------- Generated music bed --------------------------- */

const MOODS: Record<string, { chords: number[][]; bpm: number; bell: boolean }> = {
  // Frequencies (Hz) of simple triads; 4 chords per loop.
  major: { chords: [[261.6, 329.6, 392.0], [196.0, 246.9, 293.7], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6]], bpm: 92, bell: true }, // C G Am F
  playful: { chords: [[293.7, 370.0, 440.0], [329.6, 415.3, 493.9], [246.9, 293.7, 370.0], [220.0, 277.2, 329.6]], bpm: 116, bell: true }, // D E Bm A
  minor: { chords: [[220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [261.6, 329.6, 392.0], [196.0, 246.9, 293.7]], bpm: 76, bell: false }, // Am F C G
  mystery: { chords: [[220.0, 261.6, 329.6], [207.7, 261.6, 311.1], [196.0, 233.1, 293.7], [207.7, 246.9, 311.1]], bpm: 70, bell: false },
};

export function moodForGenre(genre: string) {
  return genre === "funny" || genre === "adventure" || genre === "drama" ? "playful" : genre === "emotional" ? "minor" : genre === "mystery" || genre === "twist" ? "mystery" : "major";
}

/**
 * A simple, original background pad generated from scratch (royalty-free by construction).
 * It is intentionally modest; import your own licensed music for anything more polished.
 */
export async function generateMusicBed(mood: string, durationSec: number, out: string) {
  const m = MOODS[mood] ?? MOODS.major;
  const bar = (60 / m.bpm) * 4; // seconds per chord
  const idx = `mod(floor(t/${bar.toFixed(4)}),4)`;
  const note = (k: number) => `if(eq(${idx},0),${m.chords[0][k]},if(eq(${idx},1),${m.chords[1][k]},if(eq(${idx},2),${m.chords[2][k]},${m.chords[3][k]})))`;
  const env = `(0.6+0.4*sin(PI*mod(t,${bar.toFixed(4)})/${bar.toFixed(4)}))`;
  const pad = [0, 1, 2].map((k) => `0.12*sin(2*PI*${note(k)}*t)+0.04*sin(2*PI*2*${note(k)}*t)`).join("+");
  const bass = `0.14*sin(2*PI*${note(0)}/2*t)`;
  const beat = 60 / m.bpm;
  const bell = m.bell ? `+0.06*sin(2*PI*${note(2)}*2*t)*exp(-6*mod(t,${(beat * 2).toFixed(4)}))` : "";
  const expr = `(${pad})*${env}+${bass}${bell}`;
  const d = Math.max(1, Math.min(120, durationSec + 1));
  await ffmpeg(
    ["-loglevel", "error", "-f", "lavfi", "-i", `aevalsrc='${expr}':d=${d.toFixed(2)}:s=48000`, "-af", `lowpass=f=3200,aecho=0.8:0.7:120:0.25,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, d - 2).toFixed(2)}:d=2,volume=0.8`, "-ac", "2", "-ar", "48000", out],
    { timeoutMs: 120_000 },
  );
  return out;
}
