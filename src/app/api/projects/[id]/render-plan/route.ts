import { route } from "@/lib/api";
import { renderReadiness } from "@/lib/render";
import { buildTimeline, captionCues } from "@/lib/media/timeline";
import { getEditorOptions, projectVoiceLines } from "@/lib/features/voice";
import { getAsset, listScenes, requireProject } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { matchSfx } from "@/lib/media/sfx-names";

export const dynamic = "force-dynamic";

/** Timeline preview for the editor (speech durations estimated until voices are generated). */
export const GET = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const quality = new URL(req.url).searchParams.get("quality") === "final" ? "final" : "preview";
  const s = getSettings();
  const editor = getEditorOptions(id);
  const voice = projectVoiceLines(id);
  const scenes = listScenes(id);
  const tl = buildTimeline(
    scenes.map((sc) => ({
      id: sc.id,
      idx: sc.idx,
      durationSec: sc.durationSec,
      caption: sc.caption,
      sfx: sc.sfx.map((x) => matchSfx(x)).filter((x): x is NonNullable<typeof x> => !!x),
      lines: (voice.find((v) => v.sceneId === sc.id)?.lines ?? []).map((l) => ({ text: l.text, speaker: l.speaker, durationSec: l.asset ? Number(l.durationSec) : Math.max(0.6, l.text.split(/\s+/).length / 2.6), file: null })),
    })),
    s.render.transition,
    s.render.transitionSec,
  );
  return {
    readiness: { preview: renderReadiness(id, "preview"), final: renderReadiness(id, "final"), [quality]: renderReadiness(id, quality) },
    timeline: tl,
    cues: captionCues(tl, s.render.captions ? editor.captions : "off"),
    clips: scenes.map((sc) => {
      const a = sc.clipAssetId ? getAsset(sc.clipAssetId) : null;
      return { sceneId: sc.id, url: a?.url ?? null, isDemo: !!a?.isDemo, provider: a?.provider ?? null, approval: sc.approval };
    }),
    voicesReady: voice.every((v) => v.lines.every((l) => l.asset || l.needsRecording)),
  };
});
