import { describe, it, expect } from "vitest";
import { freshDataDir } from "./helpers";

freshDataDir("story");
const { composeLocalStory, allocateDurations, beatPlan } = await import("@/lib/story/local");
const { findFruits } = await import("@/lib/story/fruits");
const { normalizeStory, generateProjectStory, shortsContent } = await import("@/lib/story");
const { openaiCompatStory, extractJson } = await import("@/lib/story/llm");
const { buildScenePrompt } = await import("@/lib/story/prompt");
const repo = await import("@/lib/repo");
const { StorySettingsSchema } = await import("@/lib/types");

const IDEA = "A lonely strawberry finds a tiny abandoned orange and decides to help it.";

describe("idea parsing", () => {
  it("finds fruits in order with their descriptors", () => {
    const f = findFruits(IDEA);
    expect(f.map((x) => x.fruit)).toEqual(["strawberry", "orange"]);
    expect(f[0].adjectives).toEqual(["lonely"]);
    expect(f[1].adjectives).toEqual(["tiny", "abandoned"]);
  });
  it("handles plurals and multi-word fruits", () => {
    expect(findFruits("three blueberries and a dragon fruit").map((x) => x.fruit)).toEqual(["blueberry", "dragonfruit"]);
  });
});

describe("local story composer", () => {
  for (const durationSec of [15, 30, 45, 60]) {
    it(`fits ${durationSec}s exactly with clips between 2 and 9 seconds`, () => {
      const sceneCount = { 15: 3, 30: 6, 45: 7, 60: 9 }[durationSec]!;
      const s = StorySettingsSchema.parse({ idea: IDEA, durationSec, sceneCount });
      const story = composeLocalStory(s);
      expect(story.scenes).toHaveLength(sceneCount);
      const total = story.scenes.reduce((a, b) => a + b.durationSec, 0);
      expect(total).toBeCloseTo(durationSec, 5);
      for (const sc of story.scenes) {
        expect(sc.durationSec).toBeGreaterThanOrEqual(2);
        expect(sc.durationSec).toBeLessThanOrEqual(9);
      }
    });
  }

  it("has a hook first, a payoff, and uses the characters from the idea", () => {
    const story = composeLocalStory(StorySettingsSchema.parse({ idea: IDEA, sceneCount: 6 }));
    expect(story.scenes[0].beat).toBe("hook");
    expect(story.scenes.some((s) => s.beat === "payoff")).toBe(true);
    expect(story.characters.map((c) => c.fruit)).toEqual(["strawberry", "orange"]);
    const [a, b] = story.characters.map((c) => c.name);
    expect(story.scenes[1].visual).toContain(b);
    expect(story.scenes.every((s) => s.characters.includes(a))).toBe(true);
    expect(story.scenes[0].narration || story.scenes[0].caption).toBeTruthy();
  });

  it("keeps speech short enough for each shot", () => {
    const story = composeLocalStory(StorySettingsSchema.parse({ idea: IDEA, sceneCount: 6 }));
    for (const sc of story.scenes) {
      const words = [sc.narration, ...sc.dialogue.map((d) => d.text)].join(" ").split(/\s+/).filter(Boolean).length;
      expect(words / 2.4).toBeLessThanOrEqual(sc.durationSec);
    }
  });

  it("respects no-dialogue and no-narrator settings", () => {
    const story = composeLocalStory(StorySettingsSchema.parse({ idea: IDEA, dialogueStyle: "no-dialogue", narratorStyle: "none" }));
    expect(story.scenes.every((s) => s.dialogue.length === 0 && s.narration === "")).toBe(true);
  });

  it("is deterministic per variation and changes with a new variation", () => {
    const s = StorySettingsSchema.parse({ idea: IDEA, genre: "funny" });
    expect(composeLocalStory(s, 0)).toEqual(composeLocalStory(s, 0));
    const titles = new Set([0, 1, 2, 3, 4].map((v) => JSON.stringify(composeLocalStory(s, v).scenes.map((x) => x.narration))));
    expect(titles.size).toBeGreaterThan(1);
  });

  it("fills in characters when the idea names none", () => {
    const story = composeLocalStory(StorySettingsSchema.parse({ idea: "Two friends get lost at the farmers market", characterCount: 3 }));
    expect(story.characters).toHaveLength(3);
  });

  it("plans beats for any scene count", () => {
    for (let n = 2; n <= 12; n++) {
      const p = beatPlan(n);
      expect(p).toHaveLength(n);
      expect(p[0]).toBe("hook");
      expect(allocateDurations(p, 60).every((d) => d >= 2 && d <= 9)).toBe(true);
    }
  });
});

describe("LLM output normalisation", () => {
  const raw = {
    title: "Pip's Big Day",
    logline: "x",
    hook: "Look!",
    description: "d",
    characters: [{ name: "Pip", fruit: "orange", appearance: "round", personality: "brave", voiceHint: "high" }],
    scenes: [
      { beat: "hook" as const, durationSec: 20, visual: "Pip rolls", camera: "close", characters: ["Pip"], action: "", emotion: "", dialogue: [], narration: "", sfx: ["Big WHOOSH!", "alien laser"], caption: "Wow 🍊" },
      { beat: "payoff" as const, durationSec: 1, visual: "Pip smiles", camera: "wide", characters: ["Pip"], action: "", emotion: "", dialogue: [{ speaker: "Pip", text: "Yay" }], narration: "", sfx: [], caption: "" },
    ],
  };
  it("rescales durations, maps SFX to the built-in library and strips emoji from captions", () => {
    const s = StorySettingsSchema.parse({ idea: IDEA, durationSec: 15, sceneCount: 2 });
    const st = normalizeStory(raw, s);
    expect(st.scenes.reduce((a, b) => a + b.durationSec, 0)).toBeCloseTo(15);
    expect(st.scenes[0].sfx).toEqual(["whoosh"]);
    expect(st.scenes[0].caption).toBe("Wow");
  });
  it("extracts JSON from fenced model output", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow(/No JSON/);
  });
  it("reports provider failures clearly (OpenAI-compatible endpoint)", async () => {
    process.env.OPENAI_COMPAT_BASE_URL = "http://localhost:9/v1";
    process.env.OPENAI_COMPAT_MODEL = "llama";
    const s = StorySettingsSchema.parse({ idea: IDEA });
    const fail = (async () => new Response("model not found", { status: 404 })) as typeof fetch;
    await expect(openaiCompatStory(s, [], 0, fail)).rejects.toThrow(/404/);
    const bad = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"title":"x"}' } }] }))) as typeof fetch;
    await expect(openaiCompatStory(s, [], 0, bad)).rejects.toThrow(/incomplete/);
    const good = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) } }] }))) as typeof fetch;
    await expect(openaiCompatStory(s, [], 0, good)).resolves.toMatchObject({ title: "Pip's Big Day" });
  });
});

describe("project story generation", () => {
  it("persists scenes, creates the Character Bible and Shorts metadata", async () => {
    const p = repo.createProject(StorySettingsSchema.parse({ idea: IDEA, sceneCount: 5 }));
    const r = await generateProjectStory(p.id, 0);
    expect(r.provider).toBe("local");
    const proj = repo.getProject(p.id)!;
    expect(proj.story?.scenes).toHaveLength(5);
    expect(repo.listScenes(p.id)).toHaveLength(5);
    const cast = repo.projectCharacters(p.id);
    expect(cast.map((c) => c.fruit)).toEqual(["strawberry", "orange"]);
    expect(cast[0].voice.pitch).not.toBe(cast[1].voice.pitch); // distinct voices
    expect(proj.content?.titles).toHaveLength(3);
    expect(proj.content?.hooks).toHaveLength(3);
    expect(proj.content?.hashtags).toContain("#shorts");
  });

  it("reuses existing characters when the story is rewritten (no silent redesign)", async () => {
    const p = repo.createProject(StorySettingsSchema.parse({ idea: IDEA }));
    await generateProjectStory(p.id, 0);
    const first = repo.projectCharacters(p.id);
    repo.updateCharacter(first[0].id, { appearance: "Custom approved look with a blue bow." });
    await generateProjectStory(p.id, 3);
    const second = repo.projectCharacters(p.id);
    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
    expect(second[0].appearance).toBe("Custom approved look with a blue bow.");
    const story = repo.getProject(p.id)!.story!;
    expect(story.characters[0].name).toBe(first[0].name);
  });

  it("injects canonical character descriptions into every scene prompt", () => {
    const prompt = buildScenePrompt({ visual: "Pip waves", camera: "close-up", action: "waves", emotion: "happy", characters: ["Pip"] }, [{ name: "Pip", fruit: "orange", appearance: "tiny orange with a blue bow" }], "3d family film");
    expect(prompt).toContain("tiny orange with a blue bow");
    expect(prompt).toMatch(/No text/);
    expect(prompt).toMatch(/9:16/);
  });

  it("shorts content never promises views", () => {
    const s = StorySettingsSchema.parse({ idea: IDEA });
    const c = shortsContent(composeLocalStory(s), s);
    expect(JSON.stringify(c)).not.toMatch(/viral|guarantee|million views/i);
  });
});

describe("fruit people style + villa drama", () => {
  const s = StorySettingsSchema.parse({ idea: "A strawberry, a banana and a watermelon all want to couple up with the new pear in the villa", genre: "drama", visualStyle: "fruit people", characterCount: 4, sceneCount: 6 });

  it("writes a reality-show arc with humanoid fruit-headed characters", () => {
    const st = composeLocalStory(s);
    expect(st.characters.map((c) => c.fruit)).toEqual(["strawberry", "banana", "watermelon", "pear"]);
    for (const c of st.characters) expect(c.appearance).toMatch(/realistic human body.*head is a glossy photoreal/);
    expect(st.scenes[0].visual).toMatch(/villa/);
    expect(st.scenes.find((x) => x.beat === "turn")?.caption).toMatch(/Recoupling/);
    expect(st.scenes.at(-1)?.caption).toMatch(/continued/);
  });

  it("prompts describe human bodies with fruit heads, keep outfits, and stay non-suggestive", () => {
    const st = composeLocalStory(s);
    const cast = st.characters.map((c) => ({ ...c, clothing: /wearing ([^.;]+)/.exec(c.appearance)![1] }));
    const prompt = buildScenePrompt(st.scenes[2], cast, "fruit people");
    expect(prompt).toMatch(/realistic human bodies/);
    expect(prompt).toMatch(/non-suggestive/);
    for (const c of cast.filter((c) => st.scenes[2].characters.includes(c.name))) expect(prompt).toContain(c.clothing);
    expect(prompt.length).toBeLessThanOrEqual(2000);
    expect(prompt).not.toMatch(/\w-$/);
  });

  it("creates Character Bible entries with human-body fields", async () => {
    const p = repo.createProject(s);
    await generateProjectStory(p.id, 0);
    const cast = repo.projectCharacters(p.id);
    expect(cast).toHaveLength(4);
    for (const c of cast) {
      expect(c.bodyShape).toMatch(/human body/); // no cute library strawberry reused
      expect(c.limbs).toMatch(/five fingers/);
    }
    expect(cast.find((c) => c.fruit === "strawberry")!.clothing).toMatch(/linen shirt/);
  });

  it("sketches use stable outfit colours and resort backdrops", async () => {
    const { sceneSvg, outfitColor } = await import("@/lib/media/sketch");
    expect(outfitColor({ name: "Bobo", fruit: "banana", palette: [], outfit: "a flowing coral sundress" })).toBe("#ff7a6b");
    expect(outfitColor({ name: "Bobo", fruit: "banana", palette: [] })).toBe(outfitColor({ name: "Bobo", fruit: "banana", palette: [] }));
    const svg = sceneSvg({ index: 1, beat: "setup", visual: "They share a lounger by the sparkling pool", camera: "medium", emotion: "flirty", caption: "", characters: [{ name: "Bobo", fruit: "banana", palette: ["#ffd84a", "#6b4f1e", "#fff3b0"], humanoid: true }] });
    expect(svg).toContain("#8fd6ff"); // pool, not "park" from "sparkling"
  });
});
