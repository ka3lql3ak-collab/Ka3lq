/**
 * Pure timeline math shared by audio mixing, captions and video assembly.
 * Scenes may be extended (holding the last frame) so speech is never cut off.
 */

export interface TimelineSceneInput {
  id: string;
  idx: number;
  durationSec: number;
  caption: string;
  sfx: string[];
  lines: { text: string; speaker: string; durationSec: number; file: string | null }[];
}

export interface TimelineScene {
  id: string;
  idx: number;
  startSec: number;
  durationSec: number; // effective (possibly extended) duration
  plannedSec: number;
  extendedBy: number;
  lines: { text: string; speaker: string; atSec: number; durationSec: number; file: string | null }[];
  sfx: { name: string; atSec: number }[];
  caption: string;
}

export interface Timeline {
  scenes: TimelineScene[];
  totalSec: number;
  transitionSec: number;
  warnings: string[];
}

export const SPEECH_LEAD = 0.25;
export const LINE_GAP = 0.15;
export const SPEECH_TAIL = 0.35;

export function buildTimeline(input: TimelineSceneInput[], transition: "cut" | "crossfade" | "fadeblack", transitionSec: number): Timeline {
  const warnings: string[] = [];
  const pre = input.map((s) => {
    const speech = s.lines.reduce((a, l) => a + l.durationSec, 0) + Math.max(0, s.lines.length - 1) * LINE_GAP;
    return { s, speech };
  });
  const effective = pre.map(({ s, speech }, i) => {
    const lead = Math.max(SPEECH_LEAD, i > 0 && transition !== "cut" ? transitionSec : 0);
    const need = speech > 0 ? lead + speech + SPEECH_TAIL : 0;
    return Math.max(s.durationSec, need);
  });
  const minEff = Math.min(...effective);
  const T = transition === "cut" || input.length < 2 ? 0 : Math.max(0, Math.min(transitionSec, minEff / 3));
  const scenes: TimelineScene[] = [];
  let start = 0;
  input.forEach((s, i) => {
    const eff = Math.round(effective[i] * 1000) / 1000;
    const lead = Math.max(SPEECH_LEAD, i > 0 ? T : 0);
    let t = start + lead;
    const lines = s.lines.map((l) => {
      const at = t;
      t += l.durationSec + LINE_GAP;
      return { ...l, atSec: round(at) };
    });
    const sfx = s.sfx.map((name, k) => ({ name, atSec: round(start + Math.max(i > 0 ? T : 0.05, (eff * (k + 1)) / (s.sfx.length + 1) - 0.15)) }));
    const extendedBy = round(eff - s.durationSec);
    if (extendedBy > 0.05) warnings.push(`Scene ${s.idx + 1}: speech needs ${eff.toFixed(1)}s, so the shot is held ${extendedBy.toFixed(1)}s longer than planned.`);
    scenes.push({ id: s.id, idx: s.idx, startSec: round(start), durationSec: eff, plannedSec: s.durationSec, extendedBy, lines, sfx, caption: s.caption });
    start += eff - (i < input.length - 1 ? T : 0);
  });
  return { scenes, totalSec: round(start), transitionSec: T, warnings };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/* -------------------------------- Captions -------------------------------- */

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export function captionCues(tl: Timeline, mode: "speech" | "captions" | "off"): Cue[] {
  if (mode === "off") return [];
  const cues: Cue[] = [];
  for (const s of tl.scenes) {
    const sceneStart = s.startSec + (s.idx > 0 ? tl.transitionSec : 0);
    const sceneEnd = s.startSec + s.durationSec - 0.05;
    if (mode === "speech" && s.lines.length) {
      for (const l of s.lines) cues.push({ start: l.atSec, end: Math.min(sceneEnd, l.atSec + l.durationSec + 0.2), text: l.text });
    } else if (s.caption.trim()) {
      cues.push({ start: sceneStart, end: sceneEnd, text: s.caption });
    }
  }
  // No overlaps: trim each cue to start of the next.
  cues.sort((a, b) => a.start - b.start);
  for (let i = 0; i < cues.length - 1; i++) if (cues[i].end > cues[i + 1].start) cues[i].end = Math.max(cues[i].start + 0.3, cues[i + 1].start - 0.02);
  return cues.filter((c) => c.end - c.start >= 0.25);
}

function ts(sec: number, sep: "," | ".") {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`;
}

export function toSrt(cues: Cue[]) {
  return cues.map((c, i) => `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${c.text}\n`).join("\n");
}

export function toVtt(cues: Cue[]) {
  return `WEBVTT\n\n${cues.map((c) => `${ts(c.start, ".")} --> ${ts(c.end, ".")}\n${c.text}\n`).join("\n")}`;
}

function assTime(sec: number) {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/**
 * Styled, mobile-safe captions. Bottom margin keeps text above the Shorts UI
 * (title/channel/buttons occupy roughly the bottom fifth and right edge).
 */
/** Spread a cue's duration over its words (weighted by length) as ASS \\k karaoke tags, in centiseconds. */
export function karaokeText(text: string, durationSec: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const weights = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const cs = Math.max(words.length, Math.round(durationSec * 100 * 0.9));
  return words.map((w, i) => `{\\k${Math.max(1, Math.round((weights[i] / total) * cs))}}${w}`).join(" ");
}

export function toAss(cues: Cue[], opts: { width: number; height: number; fontSize: number; karaoke?: boolean; hook?: { text: string; start: number; end: number } | null }) {
  const scale = opts.height / 1920;
  const size = Math.round(opts.fontSize * scale);
  const marginV = Math.round(560 * scale);
  const marginLR = Math.round(110 * scale);
  const outline = Math.max(2, Math.round(7 * scale));
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\r?\n/g, "\\N");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${opts.width}
PlayResY: ${opts.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,${size},${opts.karaoke ? "&H0036E3FF" : "&H00FFFFFF"},&H00FFFFFF,&H00201018,&H80000000,-1,0,0,0,100,100,0,0,1,${outline},${Math.round(3 * scale)},2,${marginLR},${marginLR},${marginV},1
Style: Hook,Inter,${Math.round(size * 1.15)},&H00FFFFFF,&H00FFFFFF,&H00201018,&HB0101018,-1,0,0,0,100,100,0,0,3,${Math.round(18 * scale)},0,8,${marginLR},${marginLR},${Math.round(150 * scale)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${opts.hook && opts.hook.text.trim() ? `Dialogue: 1,${assTime(opts.hook.start)},${assTime(opts.hook.end)},Hook,,0,0,0,,{\\fad(60,200)\\fscx80\\fscy80\\t(0,160,\\fscx100\\fscy100)}${esc(opts.hook.text.toUpperCase())}\n` : ""}${cues
  .map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,{\\fad(90,90)\\fscx92\\fscy92\\t(0,140,\\fscx100\\fscy100)}${opts.karaoke ? karaokeText(esc(c.text.toUpperCase()), c.end - c.start) : esc(c.text)}`)
  .join("\n")}
`;
}
