import type { StorySettings } from "../types";

interface PromptCharacter {
  name: string;
  fruit: string;
  appearance: string;
  bodyShape?: string;
  eyes?: string;
  clothing?: string;
  accessories?: string;
}
interface PromptScene {
  visual: string;
  camera: string;
  action: string;
  emotion: string;
  characters: string[];
}

export const STYLE_PREAMBLE: Record<StorySettings["visualStyle"], string> = {
  "3d family film":
    "Cinematic 3D animated family-feature-film shot, premium stylized CG, subsurface scattering on glossy fruit skin, detailed natural textures, soft global illumination, soft shadows, gentle reflections, warm appealing color palette, shallow depth of field",
  claymation: "Charming stop-motion claymation look, handcrafted clay fruit characters with fingerprint texture, miniature practical set, soft studio lighting, shallow depth of field",
  "storybook 3d": "Soft storybook 3D animation, painterly textures, pastel colors, dreamy volumetric light, cozy miniature world, shallow depth of field",
  "glossy toy": "Glossy vinyl-toy 3D style, smooth rounded shapes, bright saturated colors, clean studio lighting with soft reflections",
};

export const SAFETY_SUFFIX =
  "Each character has a consistent design, exactly two arms and two legs, one face, natural proportions. No text, no letters, no captions, no subtitles, no logos, no watermark.";

export function characterLine(c: PromptCharacter) {
  const extra = [c.bodyShape, c.eyes, c.clothing, c.accessories].filter((x) => x && x.trim()).join("; ");
  return `${c.name} the ${c.fruit}: ${c.appearance}${extra ? ` (${extra})` : ""}`;
}

/** Prompt for one scene's video clip or storyboard frame. Injects canonical character descriptions every time. */
export function buildScenePrompt(scene: PromptScene, cast: PromptCharacter[], style: StorySettings["visualStyle"], opts: { maxLen?: number; forImage?: boolean } = {}) {
  const present = cast.filter((c) => scene.characters.some((n) => n.toLowerCase() === c.name.toLowerCase()));
  const chars = present.length ? present : cast.slice(0, 1);
  const parts = [
    STYLE_PREAMBLE[style],
    `Vertical 9:16 composition, characters centered with headroom and clear silhouettes, readable on a phone screen.`,
    scene.visual,
    opts.forImage ? "" : scene.action ? `Motion: ${scene.action}` : "",
    scene.emotion ? `Mood: ${scene.emotion}.` : "",
    opts.forImage ? "" : scene.camera ? `Camera: ${scene.camera}.` : "",
    `Characters — ${chars.map(characterLine).join(" | ")}.`,
    SAFETY_SUFFIX,
  ].filter(Boolean);
  let prompt = parts.join(" ");
  const max = opts.maxLen ?? 2000;
  if (prompt.length > max) {
    // Trim character detail first, never the scene itself.
    const short = chars.map((c) => `${c.name} the ${c.fruit}: ${c.appearance.slice(0, 220)}`).join(" | ");
    prompt = [parts[0], parts[1], scene.visual, opts.forImage ? "" : scene.camera, `Characters — ${short}.`, SAFETY_SUFFIX].filter(Boolean).join(" ").slice(0, max);
  }
  return prompt;
}

/** Prompt for a character reference sheet (turnaround). */
export function buildReferencePrompt(c: PromptCharacter, style: StorySettings["visualStyle"]) {
  return `${STYLE_PREAMBLE[style]}. Character reference portrait of ${characterLine(c)}. Full body, front three-quarter view, friendly neutral expression, standing on a plain soft gradient studio background, even soft lighting, centered, whole character visible. ${SAFETY_SUFFIX}`;
}
