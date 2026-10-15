import "server-only";
import { ffmpeg } from "./ffmpeg";

/**
 * DEMO MODE ONLY: turns a storyboard image into a slow pan/zoom clip with a permanent
 * "DEMO — NOT AI VIDEO" watermark. Exists so the full pipeline (voice, captions, edit,
 * export) can be tested for free. It is never labelled or exported as AI video.
 */
export async function renderDemoClip(image: string, out: string, durationSec: number) {
  const fps = 30;
  const frames = Math.round(durationSec * fps);
  const vf = [
    "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560",
    `zoompan=z='min(zoom+0.0009,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+sin(on/40)*6':d=${frames}:s=720x1280:fps=${fps}`,
    "drawbox=x=0:y=0:w=iw:h=64:color=black@0.55:t=fill",
    "drawtext=font='Inter':text='DEMO PLACEHOLDER — NOT AI VIDEO':fontcolor=0xFFD36A:fontsize=30:x=(w-text_w)/2:y=18",
    "format=yuv420p",
  ].join(",");
  await ffmpeg(["-loglevel", "error", "-loop", "1", "-i", image, "-vf", vf, "-frames:v", String(frames), "-r", String(fps), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-an", "-movflags", "+faststart", out], {
    timeoutMs: 120_000,
  });
  return out;
}
