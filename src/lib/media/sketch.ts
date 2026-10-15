import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ffmpeg } from "./ffmpeg";
import { fruitInfo } from "../story/fruits";

/**
 * Local storyboard / reference "sketch" renderer (free). Produces an SVG illustration of
 * the scene's actual characters, then rasterizes it with FFmpeg (librsvg).
 * Sketches are planning aids only — never presented as AI renders, never used as video keyframes.
 */

export interface SketchCharacter {
  name: string;
  fruit: string;
  palette: string[];
}

type Expr = "happy" | "sad" | "surprised" | "determined" | "neutral";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function expressionFor(emotion: string): Expr {
  const e = emotion.toLowerCase();
  if (/sad|lonely|heartbroken|fragile|worried|uneasy|nervous/.test(e)) return "sad";
  if (/shock|startled|surpris|panic|frantic|breathless|puzzled/.test(e)) return "surprised";
  if (/determin|brave|daring|tense|suspicious|courage/.test(e)) return "determined";
  if (/joy|happy|hope|tender|cozy|triumph|proud|victor|delight|silly|smug|excited|peaceful|relieved/.test(e)) return "happy";
  return "neutral";
}

function bodyPath(shape: string, s: number) {
  // Centered at 0,0; s = half-size.
  switch (shape) {
    case "heart":
      return `M0 ${-s * 0.8} C ${s * 0.9} ${-s * 1.05} ${s * 1.15} ${-s * 0.1} ${s * 0.75} ${s * 0.45} C ${s * 0.45} ${s * 0.85} ${s * 0.15} ${s * 1.05} 0 ${s * 1.08} C ${-s * 0.15} ${s * 1.05} ${-s * 0.45} ${s * 0.85} ${-s * 0.75} ${s * 0.45} C ${-s * 1.15} ${-s * 0.1} ${-s * 0.9} ${-s * 1.05} 0 ${-s * 0.8} Z`;
    case "drop":
      return `M0 ${-s * 1.05} C ${s * 0.45} ${-s * 1.05} ${s * 0.5} ${-s * 0.4} ${s * 0.75} ${s * 0.1} C ${s * 1.05} ${s * 0.7} ${s * 0.6} ${s * 1.05} 0 ${s * 1.05} C ${-s * 0.6} ${s * 1.05} ${-s * 1.05} ${s * 0.7} ${-s * 0.75} ${s * 0.1} C ${-s * 0.5} ${-s * 0.4} ${-s * 0.45} ${-s * 1.05} 0 ${-s * 1.05} Z`;
    case "long":
      return `M${-s * 0.9} ${-s * 0.9} C ${-s * 0.2} ${-s * 0.3} ${s * 0.2} ${s * 0.3} ${s * 0.25} ${s * 1.05} C ${s * 0.75} ${s * 0.6} ${s * 0.75} ${-s * 0.2} ${s * 0.1} ${-s * 0.75} C ${-s * 0.2} ${-s * 1.0} ${-s * 0.6} ${-s * 1.1} ${-s * 0.9} ${-s * 0.9} Z`;
    case "tall":
      return `M0 ${-s * 1.0} C ${s * 0.8} ${-s * 1.0} ${s * 0.85} ${s * 1.05} 0 ${s * 1.05} C ${-s * 0.85} ${s * 1.05} ${-s * 0.8} ${-s * 1.0} 0 ${-s * 1.0} Z`;
    case "oval":
      return `M0 ${-s * 0.85} C ${s * 1.1} ${-s * 0.85} ${s * 1.1} ${s * 0.95} 0 ${s * 0.95} C ${-s * 1.1} ${s * 0.95} ${-s * 1.1} ${-s * 0.85} 0 ${-s * 0.85} Z`;
    default:
      return `M0 ${-s} C ${s * 1.1} ${-s} ${s * 1.1} ${s} 0 ${s} C ${-s * 1.1} ${s} ${-s * 1.1} ${-s} 0 ${-s} Z`;
  }
}

export function fruitSvg(c: SketchCharacter, x: number, y: number, size: number, expr: Expr, flip = false, uid = "c") {
  const info = fruitInfo(c.fruit);
  const [body, accent, hi] = [c.palette[0] ?? info.colors[0], c.palette[1] ?? info.colors[1], c.palette[2] ?? info.colors[2]];
  const s = size;
  const gid = `g${uid}`;
  const eyeY = info.shape === "long" ? -s * 0.15 : -s * 0.12;
  const eyeDX = s * 0.3;
  const eyeR = s * 0.2;
  const pupilShift = expr === "sad" ? s * 0.04 : 0;
  const brows =
    expr === "determined"
      ? `<path d="M${-eyeDX - eyeR} ${eyeY - eyeR * 1.4} L${-eyeDX + eyeR * 0.8} ${eyeY - eyeR * 1.0}" stroke="#2a1a1a" stroke-width="${s * 0.05}" stroke-linecap="round"/><path d="M${eyeDX + eyeR} ${eyeY - eyeR * 1.4} L${eyeDX - eyeR * 0.8} ${eyeY - eyeR * 1.0}" stroke="#2a1a1a" stroke-width="${s * 0.05}" stroke-linecap="round"/>`
      : expr === "sad"
        ? `<path d="M${-eyeDX - eyeR} ${eyeY - eyeR * 1.0} L${-eyeDX + eyeR * 0.8} ${eyeY - eyeR * 1.4}" stroke="#2a1a1a" stroke-width="${s * 0.04}" stroke-linecap="round"/><path d="M${eyeDX + eyeR} ${eyeY - eyeR * 1.0} L${eyeDX - eyeR * 0.8} ${eyeY - eyeR * 1.4}" stroke="#2a1a1a" stroke-width="${s * 0.04}" stroke-linecap="round"/>`
        : "";
  const mouthY = eyeY + s * 0.42;
  const mouth = {
    happy: `<path d="M${-s * 0.17} ${mouthY} Q0 ${mouthY + s * 0.22} ${s * 0.17} ${mouthY}" fill="#5a1a22" stroke="#2a1a1a" stroke-width="${s * 0.035}" stroke-linejoin="round"/>`,
    sad: `<path d="M${-s * 0.12} ${mouthY + s * 0.08} Q0 ${mouthY - s * 0.06} ${s * 0.12} ${mouthY + s * 0.08}" fill="none" stroke="#2a1a1a" stroke-width="${s * 0.04}" stroke-linecap="round"/>`,
    surprised: `<ellipse cx="0" cy="${mouthY + s * 0.04}" rx="${s * 0.08}" ry="${s * 0.11}" fill="#5a1a22" stroke="#2a1a1a" stroke-width="${s * 0.03}"/>`,
    determined: `<path d="M${-s * 0.13} ${mouthY + s * 0.03} L${s * 0.13} ${mouthY}" stroke="#2a1a1a" stroke-width="${s * 0.045}" stroke-linecap="round"/>`,
    neutral: `<path d="M${-s * 0.1} ${mouthY} Q0 ${mouthY + s * 0.08} ${s * 0.1} ${mouthY}" fill="none" stroke="#2a1a1a" stroke-width="${s * 0.04}" stroke-linecap="round"/>`,
  }[expr];
  const crown =
    info.shape === "tall"
      ? [-0.35, -0.12, 0.1, 0.32].map((dx, i) => `<path d="M${s * dx} ${-s * 0.92} Q${s * (dx + 0.05)} ${-s * (1.5 + (i % 2) * 0.2)} ${s * (dx + 0.12)} ${-s * 0.92}" fill="${accent}"/>`).join("")
      : info.shape === "heart"
        ? `<path d="M${-s * 0.45} ${-s * 0.78} Q${-s * 0.2} ${-s * 1.15} 0 ${-s * 0.8} Q${s * 0.2} ${-s * 1.15} ${s * 0.45} ${-s * 0.78} Q${s * 0.2} ${-s * 0.6} 0 ${-s * 0.72} Q${-s * 0.2} ${-s * 0.6} ${-s * 0.45} ${-s * 0.78} Z" fill="${accent}"/>`
        : info.shape === "long"
          ? `<rect x="${-s * 0.98}" y="${-s * 1.02}" width="${s * 0.16}" height="${s * 0.2}" rx="${s * 0.05}" fill="${accent}"/>`
          : `<path d="M0 ${-s * 0.9} q${s * 0.04} ${-s * 0.2} ${s * 0.02} ${-s * 0.28}" stroke="#6b4f1e" stroke-width="${s * 0.06}" stroke-linecap="round" fill="none"/><path d="M${s * 0.02} ${-s * 1.08} q${s * 0.35} ${-s * 0.12} ${s * 0.45} ${s * 0.08} q${-s * 0.3} ${s * 0.12} ${-s * 0.45} ${-s * 0.08}" fill="${accent}"/>`;
  const seeds =
    c.fruit === "strawberry"
      ? [[-0.4, -0.3], [0.4, -0.3], [-0.55, 0.15], [0.55, 0.15], [-0.25, 0.55], [0.25, 0.55], [0, 0.82], [-0.05, -0.5], [0.15, 0.3], [-0.2, 0.3]].map(([dx, dy]) => `<ellipse cx="${s * dx}" cy="${s * dy}" rx="${s * 0.03}" ry="${s * 0.05}" fill="#ffe08a" opacity="0.9"/>`).join("")
      : "";
  const limbs = `<g stroke="#3a2a22" stroke-width="${s * 0.07}" stroke-linecap="round" fill="none">
    <path d="M${-s * 0.82} ${s * 0.15} q${-s * 0.25} ${s * 0.1} ${-s * 0.32} ${expr === "happy" || expr === "surprised" ? -s * 0.35 : s * 0.25}"/>
    <path d="M${s * 0.82} ${s * 0.15} q${s * 0.25} ${s * 0.1} ${s * 0.32} ${expr === "happy" || expr === "surprised" ? -s * 0.35 : s * 0.25}"/>
    <path d="M${-s * 0.28} ${s * 0.95} l${-s * 0.05} ${s * 0.32}"/>
    <path d="M${s * 0.28} ${s * 0.95} l${s * 0.05} ${s * 0.32}"/>
  </g>
  <ellipse cx="${-s * 0.36}" cy="${s * 1.3}" rx="${s * 0.14}" ry="${s * 0.07}" fill="#3a2a22"/>
  <ellipse cx="${s * 0.36}" cy="${s * 1.3}" rx="${s * 0.14}" ry="${s * 0.07}" fill="#3a2a22"/>`;
  return `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)">
  <defs><radialGradient id="${gid}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${hi}"/><stop offset="0.35" stop-color="${body}"/><stop offset="1" stop-color="${shade(body, -0.35)}"/></radialGradient></defs>
  <ellipse cx="0" cy="${s * 1.38}" rx="${s * 0.85}" ry="${s * 0.12}" fill="#000" opacity="0.25"/>
  ${limbs}
  <path d="${bodyPath(info.shape, s)}" fill="url(#${gid})" stroke="${shade(body, -0.5)}" stroke-width="${s * 0.03}"/>
  ${seeds}
  ${crown}
  <ellipse cx="${-s * 0.18}" cy="${-s * 0.5}" rx="${s * 0.16}" ry="${s * 0.09}" fill="#fff" opacity="0.35" transform="rotate(-25 ${-s * 0.18} ${-s * 0.5})"/>
  <g transform="scale(${flip ? -1 : 1} 1)">
    <ellipse cx="${-eyeDX}" cy="${eyeY}" rx="${eyeR}" ry="${eyeR * 1.2}" fill="#fff" stroke="#2a1a1a" stroke-width="${s * 0.025}"/>
    <ellipse cx="${eyeDX}" cy="${eyeY}" rx="${eyeR}" ry="${eyeR * 1.2}" fill="#fff" stroke="#2a1a1a" stroke-width="${s * 0.025}"/>
    <circle cx="${-eyeDX + s * 0.03}" cy="${eyeY + s * 0.04 + pupilShift}" r="${eyeR * 0.68}" fill="#2a1a2a"/>
    <circle cx="${eyeDX + s * 0.03}" cy="${eyeY + s * 0.04 + pupilShift}" r="${eyeR * 0.68}" fill="#2a1a2a"/>
    <circle cx="${-eyeDX + s * 0.09}" cy="${eyeY - s * 0.04}" r="${eyeR * 0.26}" fill="#fff"/>
    <circle cx="${eyeDX + s * 0.09}" cy="${eyeY - s * 0.04}" r="${eyeR * 0.26}" fill="#fff"/>
    <circle cx="${-eyeDX - s * 0.04}" cy="${eyeY + s * 0.12}" r="${eyeR * 0.11}" fill="#fff"/>
    <circle cx="${eyeDX - s * 0.04}" cy="${eyeY + s * 0.12}" r="${eyeR * 0.11}" fill="#fff"/>
    ${brows}
    <ellipse cx="${-s * 0.52}" cy="${eyeY + s * 0.3}" rx="${s * 0.12}" ry="${s * 0.07}" fill="#ff7b9a" opacity="0.55"/>
    <ellipse cx="${s * 0.52}" cy="${eyeY + s * 0.3}" rx="${s * 0.12}" ry="${s * 0.07}" fill="#ff7b9a" opacity="0.55"/>
    ${mouth}
    ${expr === "sad" ? `<path d="M${-eyeDX + s * 0.05} ${eyeY + eyeR * 1.1} q${-s * 0.04} ${s * 0.12} 0 ${s * 0.18}" fill="#8ad3ff" opacity="0.9"/>` : ""}
  </g>
</g>`;
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function backdrop(text: string) {
  const t = text.toLowerCase();
  if (/night|moon|midnight|dark/.test(t)) return { top: "#1b2350", bottom: "#070a1a", ground: "#2a2f55", glow: "#c8d2ff" };
  if (/rain|grey|storm/.test(t)) return { top: "#6f7f94", bottom: "#2c3442", ground: "#4a5566", glow: "#d6e6ff" };
  if (/garden|jungle|leaves|grass|park/.test(t)) return { top: "#a8e08a", bottom: "#2f6b3a", ground: "#4f8f3f", glow: "#fff6b0" };
  if (/fridge|cool blue|frost|snow|winter/.test(t)) return { top: "#d6efff", bottom: "#5d8fb8", ground: "#9cc6e6", glow: "#ffffff" };
  if (/party|confetti|fairy/.test(t)) return { top: "#5a2a7a", bottom: "#1f0f33", ground: "#7a3a8a", glow: "#ffd1f0" };
  if (/beach|sea|tropical/.test(t)) return { top: "#7fd3ff", bottom: "#f5d98a", ground: "#f0cf8a", glow: "#fffbe0" };
  if (/supermarket|fluorescent|aisle/.test(t)) return { top: "#3a4048", bottom: "#15181c", ground: "#555c66", glow: "#e8f4ff" };
  return { top: "#ffd9a0", bottom: "#8a4f2a", ground: "#c98a5a", glow: "#fff1cc" };
}

function wrap(text: string, max: number, lines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
      if (out.length === lines) break;
    } else cur += " " + w;
  }
  if (out.length < lines && cur.trim()) out.push(cur.trim());
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…");
  return out;
}

export interface SceneSketchInput {
  index: number;
  beat: string;
  visual: string;
  camera: string;
  emotion: string;
  caption: string;
  characters: SketchCharacter[];
}

export function sceneSvg(sc: SceneSketchInput, W = 540, H = 960) {
  const bg = backdrop(`${sc.visual} ${sc.camera}`);
  const cam = sc.camera.toLowerCase();
  const zoom = /extreme close/.test(cam) ? 1.9 : /close/.test(cam) ? 1.45 : /wide|establish/.test(cam) ? 0.7 : 1;
  const expr = expressionFor(sc.emotion);
  const chars = sc.characters.slice(0, 3);
  const baseSize = (chars.length <= 1 ? 120 : chars.length === 2 ? 95 : 75) * zoom;
  const groundY = H * 0.62;
  const xs = chars.length <= 1 ? [W / 2] : chars.length === 2 ? [W * 0.3, W * 0.7] : [W * 0.22, W * 0.5, W * 0.78];
  const figs = chars
    .map((c, i) => fruitSvg(c, xs[i], groundY - baseSize * 1.35 + (chars.length === 3 && i === 1 ? -10 : 0), baseSize * (i === 0 && chars.length > 1 ? 1.05 : 1), i === 0 ? expr : expr === "sad" ? "sad" : expr, chars.length > 1 && i === chars.length - 1, `s${sc.index}_${i}`))
    .join("\n");
  const labels = zoom > 1.3 ? "" : chars.map((c, i) => `<text x="${xs[i]}" y="${Math.min(groundY + baseSize * 0.55, H * 0.73)}" text-anchor="middle" font-family="Inter" font-size="20" font-weight="700" fill="#fff" opacity="0.85">${esc(c.name)}</text>`).join("");
  const visLines = wrap(sc.visual, 46, 4);
  const camLines = wrap(`🎥 ${sc.camera}`.replace("🎥 ", "CAMERA: "), 50, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg.top}"/><stop offset="1" stop-color="${bg.bottom}"/></linearGradient>
    <radialGradient id="glow" cx="75%" cy="18%" r="60%"><stop offset="0" stop-color="${bg.glow}" stop-opacity="0.65"/><stop offset="1" stop-color="${bg.glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0a10" stop-opacity="0.0"/><stop offset="0.25" stop-color="#0b0a10" stop-opacity="0.88"/><stop offset="1" stop-color="#0b0a10" stop-opacity="0.96"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <path d="M0 ${groundY} Q ${W / 2} ${groundY - 30} ${W} ${groundY} L ${W} ${H} L 0 ${H} Z" fill="${bg.ground}" opacity="0.9"/>
  ${figs}
  ${labels}
  <rect x="0" y="${H * 0.66}" width="${W}" height="${H * 0.34}" fill="url(#panel)"/>
  <rect x="18" y="18" rx="10" width="190" height="34" fill="#0b0a10" opacity="0.7"/>
  <text x="32" y="41" font-family="Inter" font-size="17" font-weight="800" fill="#ffb07a">SCENE ${sc.index + 1} · ${esc(sc.beat.toUpperCase())}</text>
  <rect x="${W - 150}" y="18" rx="10" width="132" height="34" fill="#0b0a10" opacity="0.7"/>
  <text x="${W - 84}" y="41" text-anchor="middle" font-family="Inter" font-size="14" font-weight="700" fill="#ffd36a">SKETCH · NOT AI</text>
  ${visLines.map((l, i) => `<text x="28" y="${H * 0.745 + i * 26}" font-family="Inter" font-size="19" fill="#e8e4f0">${esc(l)}</text>`).join("")}
  ${camLines.map((l, i) => `<text x="28" y="${H * 0.745 + visLines.length * 26 + 14 + i * 22}" font-family="Inter" font-size="15" fill="#9fc9ff">${esc(l)}</text>`).join("")}
  ${sc.caption ? `<text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="Inter" font-size="22" font-weight="800" fill="#ffffff">“${esc(sc.caption.slice(0, 40))}”</text>` : ""}
</svg>`;
}

export function referenceSvg(c: SketchCharacter & { personality?: string }, W = 768, H = 768) {
  const views = [
    { x: W * 0.5, size: 150, expr: "happy" as Expr, label: "Front" },
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><radialGradient id="rbg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#3a344b"/><stop offset="1" stop-color="#121019"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#rbg)"/>
  ${views.map((v, i) => fruitSvg(c, v.x, H * 0.44, v.size, v.expr, false, `r${i}`)).join("")}
  ${fruitSvg(c, W * 0.17, H * 0.78, 52, "surprised", false, "r1")}
  ${fruitSvg(c, W * 0.39, H * 0.78, 52, "sad", false, "r2")}
  ${fruitSvg(c, W * 0.61, H * 0.78, 52, "determined", false, "r3")}
  ${fruitSvg(c, W * 0.83, H * 0.78, 52, "happy", true, "r4")}
  <text x="32" y="52" font-family="Inter" font-size="30" font-weight="800" fill="#fff">${esc(c.name)}</text>
  <text x="32" y="82" font-family="Inter" font-size="18" fill="#b7b2c6">${esc(c.fruit)} · reference sketch</text>
  <text x="${W - 32}" y="52" text-anchor="end" font-family="Inter" font-size="15" font-weight="700" fill="#ffd36a">SKETCH · NOT AI</text>
  <g font-family="Inter" font-size="14" fill="#8a849c" text-anchor="middle">
    <text x="${W * 0.17}" y="${H - 22}">surprised</text><text x="${W * 0.39}" y="${H - 22}">sad</text><text x="${W * 0.61}" y="${H - 22}">determined</text><text x="${W * 0.83}" y="${H - 22}">happy</text>
  </g>
  ${c.palette.map((p, i) => `<rect x="${W - 32 - (c.palette.length - i) * 34}" y="70" width="26" height="26" rx="6" fill="${p}" stroke="#fff" stroke-opacity="0.3"/>`).join("")}
</svg>`;
}

export async function rasterize(svg: string, outPng: string) {
  const tmp = outPng.replace(/\.png$/, ".svg");
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  fs.writeFileSync(tmp, svg);
  try {
    await ffmpeg(["-loglevel", "error", "-i", tmp, "-frames:v", "1", outPng], { timeoutMs: 60_000 });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return outPng;
}
