import "server-only";
import { composeLocalStory, allocateDurations } from "./local";
import { anthropicStory, openaiCompatStory, type LlmStory, type ExistingCharacter } from "./llm";
import { fruitInfo } from "./fruits";
import { matchSfx } from "../media/sfx-names";
import { StorySchema, isHumanoidStyle, type Story, type StorySettings, type ShortsContent, type CharacterInput } from "../types";
import {
  createCharacter,
  linkCharacters,
  listCharacters,
  projectCharacters,
  replaceScenes,
  requireProject,
  updateProject,
  type Character,
} from "../repo";
import { capabilities } from "../settings";

export function normalizeStory(raw: LlmStory | Story, s: StorySettings): Story {
  const scenes = raw.scenes.slice(0, 12).map((sc) => ({
    ...sc,
    durationSec: Number.isFinite(sc.durationSec) ? sc.durationSec : 4,
    sfx: [...new Set((sc.sfx ?? []).map((x) => matchSfx(x)).filter((x): x is NonNullable<typeof x> => !!x))].slice(0, 3),
    caption: (sc.caption ?? "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim().slice(0, 160),
    dialogue: (sc.dialogue ?? []).filter((d) => d.text?.trim()).slice(0, 6),
    characters: (sc.characters ?? []).slice(0, 4),
  }));
  if (scenes.length < 2) throw new Error("The story needs at least 2 scenes.");
  // Rescale durations to the requested total while keeping each clip 2–9 s.
  const total = scenes.reduce((a, b) => a + b.durationSec, 0);
  if (Math.abs(total - s.durationSec) > 0.5 || scenes.some((x) => x.durationSec < 2 || x.durationSec > 9)) {
    const ds = allocateDurations(
      scenes.map((x) => x.beat),
      s.durationSec,
    );
    scenes.forEach((x, i) => (x.durationSec = ds[i]));
  }
  return StorySchema.parse({ ...raw, scenes, characters: raw.characters.slice(0, 4) });
}

export async function writeStory(s: StorySettings, existing: ExistingCharacter[], variation = 0): Promise<{ story: Story; provider: string; warning?: string }> {
  const caps = capabilities();
  if (s.storyProvider === "anthropic") {
    if (!caps.anthropic) throw new Error("Anthropic is not configured (ANTHROPIC_API_KEY missing or demo mode forced). Choose the local composer or add a key.");
    return { story: normalizeStory(await anthropicStory(s, existing, variation), s), provider: "anthropic" };
  }
  if (s.storyProvider === "openai-compat") {
    return { story: normalizeStory(await openaiCompatStory(s, existing, variation), s), provider: "openai-compat" };
  }
  const story = normalizeStory(composeLocalStory(s, variation), s);
  if (existing.length) {
    // Keep approved library characters: map story cast onto them by fruit, in order.
    story.characters = story.characters.map((c, i) => {
      const ex = existing.find((e) => e.fruit.toLowerCase() === c.fruit.toLowerCase()) ?? existing[i];
      if (!ex) return c;
      renameEverywhere(story, c.name, ex.name);
      return { ...c, name: ex.name, fruit: ex.fruit, appearance: ex.appearance || c.appearance, personality: ex.personality || c.personality };
    });
  }
  const warning = !/^english$/i.test(s.language) ? `The free local composer writes in English only. Use Anthropic or a local Ollama model for ${s.language}.` : undefined;
  return { story, provider: "local", warning };
}

function renameEverywhere(story: Story, from: string, to: string) {
  if (from === to) return;
  const re = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  for (const sc of story.scenes) {
    sc.visual = sc.visual.replace(re, to);
    sc.action = sc.action.replace(re, to);
    sc.narration = sc.narration.replace(re, to);
    sc.caption = sc.caption.replace(re, to);
    sc.characters = sc.characters.map((c) => (c === from ? to : c));
    sc.dialogue = sc.dialogue.map((d) => ({ speaker: d.speaker === from ? to : d.speaker, text: d.text.replace(re, to) }));
  }
  story.title = story.title.replace(re, to);
  story.hook = story.hook.replace(re, to);
}

const VOICE_PRESETS: CharacterInput["voice"][] = [
  { engine: "flite", voice: "slt", pitch: 1.25, speed: 1.0, volume: 1 },
  { engine: "flite", voice: "slt", pitch: 1.55, speed: 1.05, volume: 1 },
  { engine: "flite", voice: "kal16", pitch: 1.15, speed: 0.95, volume: 1 },
  { engine: "flite", voice: "awb", pitch: 1.3, speed: 1.0, volume: 1 },
];

/** Ensure every story character exists in the Character Bible and is linked to the project. */
export function syncCharacters(projectId: string, story: Story, style = "3d family film"): Character[] {
  const linked = projectCharacters(projectId);
  const library = listCharacters();
  const ids: string[] = [];
  story.characters.forEach((sc, i) => {
    const match =
      linked.find((c) => c.name.toLowerCase() === sc.name.toLowerCase()) ??
      // Reuse a library character only if it's drawn in the same style (never put a round cartoon fruit in a fruit-people project, or vice versa).
      library.find((c) => c.name.toLowerCase() === sc.name.toLowerCase() && c.fruit.toLowerCase() === sc.fruit.toLowerCase() && /human/i.test(c.bodyShape) === isHumanoidStyle(style));
    if (match) {
      ids.push(match.id);
      return;
    }
    const info = fruitInfo(sc.fruit);
    const humanoid = isHumanoidStyle(style);
    const created = createCharacter(humanoid ? {
      name: sc.name,
      fruit: info.key,
      appearance: sc.appearance,
      bodyShape: "Adult human body with natural skin and realistic proportions; the head is the fruit",
      face: `Human-like face sculpted into the ${info.key}: defined eyebrows, small nose, full lips, soft blush`,
      eyes: "Large, expressive, glossy human-like eyes with long lashes",
      mouth: "Full, expressive lips; confident smirks and big reactions",
      limbs: "Natural human arms, hands with five fingers, and legs",
      clothing: (/wearing ([^.;]+)/.exec(sc.appearance)?.[1] ?? "stylish resort wear").trim(),
      accessories: "",
      personality: sc.personality,
      palette: info.colors.slice(0, 3),
      voice: VOICE_PRESETS[i % VOICE_PRESETS.length],
    } : {
      name: sc.name,
      fruit: info.key,
      appearance: sc.appearance,
      bodyShape: `${info.shape === "long" ? "Long, gently curved" : info.shape === "tall" ? "Tall and sturdy" : info.shape === "small" ? "Tiny and round" : "Rounded, squishy"} ${info.key}-shaped body`,
      face: "Soft, expressive face with rosy cheeks, positioned on the upper half of the body",
      eyes: "Huge, glossy, emotional eyes with large pupils and sparkly highlights",
      mouth: "Small, flexible mouth capable of big smiles and pouts",
      limbs: "Short noodle-like arms with three-fingered mitten hands, stubby legs with tiny shoes",
      clothing: "",
      accessories: (/wearing ([^.;]+)/.exec(sc.appearance)?.[1] ?? "").trim(),
      personality: sc.personality,
      palette: info.colors.slice(0, 3),
      voice: VOICE_PRESETS[i % VOICE_PRESETS.length],
    });
    ids.push(created.id);
  });
  linkCharacters(projectId, ids);
  return projectCharacters(projectId);
}

export function shortsContent(story: Story, s: StorySettings): ShortsContent {
  const [A, B] = story.characters;
  const fruitTags = [...new Set(story.characters.map((c) => `#${c.fruit.replace(/\s+/g, "")}`))];
  let t = 0;
  const starts = story.scenes.map((sc) => {
    const at = t;
    t += sc.durationSec;
    return at;
  });
  const payoffIdx = Math.max(0, story.scenes.findIndex((x) => x.beat === "payoff"));
  const hookLine = story.hook || story.scenes[0].caption;
  return {
    hooks: [
      hookLine,
      B ? `What would you do if you found a ${B.fruit} all alone?` : `${A.name} is about to have the best day ever.`,
      B ? `${A.name} wasn't supposed to help. ${A.name} did anyway.` : `Wait for the ending…`,
    ],
    titles: [
      story.title,
      B ? `${A.name} the ${cap(A.fruit)} Helps a Tiny ${cap(B.fruit)}` : `${A.name}'s Big Adventure`,
      B ? `This ${cap(A.fruit)} Made a New Friend` : `A ${cap(A.fruit)}'s Story`,
    ],
    description: `${story.logline || story.description}\n\nAn original ${s.genre} 3D animated fruit short. ${story.characters.map((c) => `${c.name} the ${c.fruit}`).join(", ")}.\n\nMade with AI-assisted animation.`,
    hashtags: ["#shorts", "#animation", "#cute", "#3danimation", "#fruit", ...fruitTags, `#${s.genre}`, "#storytime"].slice(0, 12),
    pinnedComment: B ? `Should ${A.name} and ${B.name} get another adventure? Tell us what happens next!` : `What should ${A.name} do next? Comment below!`,
    coverSuggestions: [
      { sceneIndex: payoffIdx, reason: "Emotional payoff — both characters' faces, warm light", atSec: starts[payoffIdx] + story.scenes[payoffIdx].durationSec / 2 },
      { sceneIndex: 0, reason: "Hook close-up — big expressive eyes read well as a thumbnail", atSec: Math.min(1, story.scenes[0].durationSec / 2) },
      ...(story.scenes.length > 2 ? [{ sceneIndex: Math.floor(story.scenes.length / 2), reason: "Mid-story conflict — curiosity gap", atSec: starts[Math.floor(story.scenes.length / 2)] + 1 }] : []),
    ],
  };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Generate + persist a story for a project (used by the story job). */
export async function generateProjectStory(projectId: string, variation: number) {
  const p = requireProject(projectId);
  const existing = projectCharacters(projectId).map((c) => ({ name: c.name, fruit: c.fruit, appearance: c.appearance, personality: c.personality }));
  const { story, provider, warning } = await writeStory(p.settings, existing, variation);
  updateProject(projectId, { story, title: story.title, content: shortsContent(story, p.settings), scriptApproved: false, status: "script" });
  replaceScenes(projectId, story.scenes);
  syncCharacters(projectId, story, p.settings.visualStyle);
  return { provider, warning, scenes: story.scenes.length };
}
