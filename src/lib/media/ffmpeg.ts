import "server-only";
import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

/** Run a binary with args (no shell — arguments are never interpreted). */
export function run(bin: string, args: string[], opts: { timeoutMs?: number; onStderr?: (line: string) => void; input?: string; cwd?: string } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], cwd: opts.cwd });
    let stdout = "";
    let stderr = "";
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`${bin} timed out after ${Math.round(opts.timeoutMs! / 1000)}s`));
        }, opts.timeoutMs)
      : null;
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
      if (opts.onStderr) for (const line of s.split(/\r|\n/)) if (line.trim()) opts.onStderr(line);
    });
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`Could not start ${bin}: ${e.message}`));
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    if (opts.input) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

export async function ffmpeg(args: string[], opts: Parameters<typeof run>[2] = {}) {
  const r = await run(FFMPEG, ["-hide_banner", "-nostdin", "-y", ...args], { timeoutMs: 15 * 60_000, ...opts });
  if (r.code !== 0) {
    const tail = r.stderr.split("\n").filter((l) => l.trim()).slice(-8).join("\n");
    throw new Error(`FFmpeg failed (exit ${r.code}):\n${tail}`);
  }
  return r;
}

export interface ProbeInfo {
  durationSec: number;
  width?: number;
  height?: number;
  fps?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
}

/** Inspect a media file. Throws a readable error for missing/corrupt files. */
export async function probe(file: string): Promise<ProbeInfo> {
  const r = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { timeoutMs: 30_000 });
  if (r.code !== 0) throw new Error(`File is unreadable or corrupt: ${r.stderr.trim().split("\n").pop() ?? "ffprobe failed"}`);
  const j = JSON.parse(r.stdout) as { format?: { duration?: string }; streams?: Array<Record<string, string | number>> };
  const v = j.streams?.find((s) => s.codec_type === "video");
  const a = j.streams?.find((s) => s.codec_type === "audio");
  const rate = typeof v?.avg_frame_rate === "string" && v.avg_frame_rate.includes("/") ? v.avg_frame_rate.split("/").map(Number) : null;
  return {
    durationSec: Number(j.format?.duration ?? v?.duration ?? a?.duration ?? 0),
    width: v ? Number(v.width) : undefined,
    height: v ? Number(v.height) : undefined,
    fps: rate && rate[1] ? rate[0] / rate[1] : undefined,
    hasVideo: !!v,
    hasAudio: !!a,
    videoCodec: v?.codec_name as string | undefined,
    audioCodec: a?.codec_name as string | undefined,
  };
}

let toolCache: { ffmpeg: boolean; flite: boolean; libass: boolean; version: string } | null = null;
export async function detectTools() {
  if (toolCache) return toolCache;
  try {
    const v = await run(FFMPEG, ["-hide_banner", "-version"], { timeoutMs: 10_000 });
    const f = await run(FFMPEG, ["-hide_banner", "-filters"], { timeoutMs: 10_000 });
    toolCache = {
      ffmpeg: v.code === 0,
      flite: /\bflite\b/.test(f.stdout),
      libass: /\bsubtitles\b/.test(f.stdout),
      version: v.stdout.split("\n")[0] ?? "",
    };
  } catch {
    toolCache = { ffmpeg: false, flite: false, libass: false, version: "" };
  }
  return toolCache;
}
