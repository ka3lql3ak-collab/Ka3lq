/**
 * Free, offline story composer. Template-driven, seeded by the idea so results are
 * repeatable, with a "variation" number for regenerating alternatives. It parses the
 * idea for fruits, descriptors and the goal, then writes a hook → conflict → payoff arc.
 * LLM providers produce richer stories; this one guarantees the app works for $0.
 */
import { findFruits, fruitInfo } from "./fruits";
import { isHumanoidStyle, type Story, type StoryScene, type StorySettings, type DialogueLine } from "../types";

type Beat = StoryScene["beat"];

export function seededRng(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function beatPlan(n: number): Beat[] {
  const base: Record<number, Beat[]> = {
    2: ["hook", "payoff"],
    3: ["hook", "conflict", "payoff"],
    4: ["hook", "setup", "conflict", "payoff"],
    5: ["hook", "setup", "conflict", "turn", "payoff"],
    6: ["hook", "setup", "conflict", "turn", "payoff", "button"],
  };
  if (base[n]) return base[n];
  const plan: Beat[] = ["hook", "setup", "conflict", "turn", "payoff", "button"];
  let extra = n - 6;
  let insertAt = 2;
  while (extra-- > 0) {
    plan.splice(insertAt, 0, extra % 2 === 0 ? "conflict" : "setup");
    insertAt = Math.min(plan.length - 3, insertAt + 1);
  }
  return plan;
}

const WEIGHT: Record<Beat, number> = { hook: 0.75, setup: 1, conflict: 1.15, turn: 1, payoff: 1.3, button: 0.7 };

/** Split the total duration over beats; each scene 2–9 s (fits 5 s/9 s AI clips), 0.5 s steps. */
export function allocateDurations(beats: Beat[], total: number): number[] {
  const w = beats.map((b) => WEIGHT[b]);
  const sum = w.reduce((a, b) => a + b, 0);
  let d = w.map((x) => Math.max(2, Math.min(9, Math.round(((x / sum) * total) * 2) / 2)));
  for (let guard = 0; guard < 200; guard++) {
    const diff = Math.round((total - d.reduce((a, b) => a + b, 0)) * 2) / 2;
    if (diff === 0) break;
    const step = diff > 0 ? 0.5 : -0.5;
    const order = d.map((_, i) => i).sort((a, b) => (step > 0 ? d[a] - d[b] : d[b] - d[a]));
    const i = order.find((k) => d[k] + step >= 2 && d[k] + step <= 9);
    if (i === undefined) break;
    d[i] += step;
  }
  d = d.map((x) => Math.round(x * 2) / 2);
  return d;
}

interface Cast {
  name: string;
  fruit: string;
  adj: string;
  he: string; // pronoun handling kept neutral: "they"
}

const SETTINGS: { kw: RegExp; place: string; light: string }[] = [
  { kw: /kitchen|counter|breakfast|table/, place: "a sunlit farmhouse kitchen counter", light: "warm morning light streaming through a window" },
  { kw: /market|shop|store|supermarket|aisle/, place: "a cozy farmers' market stall with wooden crates", light: "soft golden late-afternoon light" },
  { kw: /garden|backyard|grass|tree|orchard/, place: "a lush backyard garden seen from fruit height, like a jungle", light: "dappled sunlight through leaves" },
  { kw: /picnic|park/, place: "a red-checkered picnic blanket in a sunny park", light: "bright summer sunshine with soft bokeh" },
  { kw: /fridge|refrigerator|cold/, place: "the glowing shelves inside a refrigerator", light: "cool blue-white fridge light" },
  { kw: /beach|sea|ocean|sand/, place: "a sandy beach towel by the sparkling sea", light: "glittering tropical sunlight" },
  { kw: /rain|storm|window/, place: "a rain-streaked windowsill", light: "soft grey daylight with raindrops glowing" },
  { kw: /night|moon|dark|midnight/, place: "a quiet pantry shelf at night", light: "silvery moonlight and a warm nightlight glow" },
  { kw: /party|birthday|cake/, place: "a party table covered in confetti and candles", light: "warm twinkling fairy lights" },
  { kw: /snow|winter|christmas/, place: "a frosty windowsill with snow falling outside", light: "cozy warm interior light against blue winter dusk" },
];

const GENRE_DEFAULT_SETTING: Record<StorySettings["genre"], { place: string; light: string }> = {
  wholesome: { place: "a sunlit farmhouse kitchen counter", light: "warm morning light streaming through a window" },
  funny: { place: "a busy fruit bowl on a breakfast table", light: "bright cheerful morning light" },
  emotional: { place: "a rain-streaked windowsill", light: "soft grey daylight with raindrops glowing" },
  adventure: { place: "a lush backyard garden seen from fruit height, like a jungle", light: "dappled sunlight through leaves" },
  mystery: { place: "a quiet pantry shelf at night", light: "silvery moonlight and a warm nightlight glow" },
  twist: { place: "a quiet supermarket produce aisle after closing", light: "dim fluorescent light with long soft shadows" },
  drama: { place: "the pool deck of a luxury tropical villa with palm trees and sun loungers", light: "bright golden-hour sunshine sparkling on the pool" },
};

const ADJ_TRAITS: Record<string, string> = {
  lonely: "shy, gentle and quietly hopeful",
  tiny: "small but brave and curious",
  abandoned: "nervous and a little lost, but sweet",
  lost: "worried yet trusting",
  grumpy: "grumpy on the outside, soft on the inside",
  brave: "bold, loyal and a bit reckless",
  shy: "timid, kind and observant",
  curious: "endlessly curious and chatty",
  old: "wise, patient and funny",
  wise: "calm, wise and warm",
  little: "small, bouncy and eager",
  sad: "tender-hearted and hopeful",
  happy: "sunny, bubbly and optimistic",
  clumsy: "clumsy, enthusiastic and lovable",
  sleepy: "dreamy, slow and sweet",
};

function traitFor(adj: string, fallback: string) {
  return ADJ_TRAITS[adj] ?? fallback;
}

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function extractGoal(idea: string, a: Cast, b: Cast | undefined): string {
  const m = /\b(?:decides? to|wants? to|tries? to|must|has to|needs? to|learns? to|sets? out to)\s+([^.!?]+)/i.exec(idea);
  let goal = m ? m[1].trim() : b ? `help ${b.name}` : "find a friend";
  if (b) goal = goal.replace(/\b(it|him|her|them)\b/gi, b.name);
  goal = goal.replace(/\b(the|a|an)\s+(\w+\s+)?(\w+)\b/gi, (full, _art, _adj, noun: string) => {
    if (b && noun.toLowerCase().startsWith(b.fruit)) return b.name;
    if (noun.toLowerCase().startsWith(a.fruit)) return a.name;
    return full;
  });
  return goal.replace(/\s+/g, " ");
}

function problemFor(b: Cast | undefined, genre: StorySettings["genre"]): string {
  const adj = b?.adj ?? "";
  if (/abandon|lost|alone|lonely|orphan/.test(adj)) return `${b!.name} is lost and far from home`;
  if (/grumpy|angry|mean/.test(adj)) return `${b!.name} refuses to let anyone get close`;
  if (/scared|shy|tiny|little/.test(adj)) return `${b!.name} is too small to climb back to the fruit bowl`;
  return {
    wholesome: `${b?.name ?? "a new friend"} is stuck on the wrong side of the counter`,
    funny: `a runaway rolling pin is heading straight for them`,
    emotional: `${b?.name ?? "a friend"} might be picked for a smoothie today`,
    adventure: `the way home is blocked by a giant garden hose river`,
    mystery: `someone keeps stealing the sugar cubes at night`,
    twist: `the store closes in one minute and the lights are going out`,
    drama: `${b?.name ?? "someone"} was already coupled up with someone else`,
  }[genre];
}

const NARR_HOOK: Record<StorySettings["genre"], string[]> = {
  wholesome: ["Nobody ever noticed {A}… until today.", "{A} had never had a friend. That was about to change."],
  funny: ["{A} had one rule: never talk to strangers. It lasted four seconds.", "This is {A}. {A} is about to make a terrible decision."],
  emotional: ["{A} had been waiting on this windowsill for a very long time.", "Some fruits are picked first. {A} was always picked last."],
  adventure: ["{A} had never been past the edge of the counter.", "Every hero starts small. {A} started very small."],
  mystery: ["Every night, something moved in the pantry. Tonight, {A} was watching.", "Nobody knew who left the tiny footprints. {A} was going to find out."],
  twist: ["Everyone thought {A} was the loneliest fruit in the store. Everyone was wrong.", "{A} thought this was an ordinary night. It wasn't."],
  drama: ["Day one in the villa, and {A} is already causing drama.", "Nobody expected {A} to walk in like that."],
};

interface Ctx {
  A: Cast;
  B?: Cast;
  C?: Cast;
  place: string;
  light: string;
  goal: string;
  problem: string;
  s: StorySettings;
  rnd: () => number;
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function fill(t: string, c: Ctx) {
  return t
    .replace(/\{A\}/g, c.A.name)
    .replace(/\{B\}/g, c.B?.name ?? "a stranger")
    .replace(/\{C\}/g, c.C?.name ?? "an old friend")
    .replace(/\{fa\}/g, c.A.fruit)
    .replace(/\{fb\}/g, c.B?.fruit ?? "fruit")
    .replace(/\{place\}/g, c.place)
    .replace(/\{light\}/g, c.light)
    .replace(/\{goal\}/g, c.goal)
    .replace(/\{problem\}/g, c.problem);
}

type Lines = { [K in StorySettings["dialogueStyle"]]?: [string, string][] };

function dialogueFor(c: Ctx, beat: Beat): DialogueLine[] {
  const style = c.s.dialogueStyle;
  if (style === "no-dialogue") return [];
  const L: Record<Beat, Lines> = {
    hook: { playful: [["A", "Hello? …Anybody?"]], heartfelt: [["A", "Just me again."]], witty: [["A", "Great. Another thrilling day of sitting."]], minimal: [["A", "Hm?"]] },
    setup: {
      playful: [["A", "Whoa—who are you?"], ["B", "I-I'm {B}. I think I'm lost."]],
      heartfelt: [["B", "I don't know where I am."], ["A", "That's okay. You're not alone now."]],
      witty: [["A", "You look like you rolled off the wrong shelf."], ["B", "Is it that obvious?"]],
      minimal: [["B", "…Help?"]],
    },
    conflict: {
      playful: [["B", "It's too far! We'll never make it!"], ["A", "Not with that attitude!"]],
      heartfelt: [["B", "Maybe I should just stay here."], ["A", "No. We'll find a way."]],
      witty: [["A", "Okay. New plan. Same as the old plan, but faster."]],
      minimal: [["A", "Uh-oh."]],
    },
    turn: {
      playful: [["A", "I've got an idea! Hold on tight!"]],
      heartfelt: [["A", "Trust me, okay?"], ["B", "…Okay."]],
      witty: [["A", "This is either genius or a very short story."]],
      minimal: [["A", "Now!"]],
    },
    payoff: {
      playful: [["B", "We did it! We actually did it!"], ["A", "Told you!"]],
      heartfelt: [["B", "Thank you… for not leaving me."], ["A", "That's what friends do."]],
      witty: [["B", "You're kind of amazing, you know that?"], ["A", "I do now."]],
      minimal: [["B", "Friends?"], ["A", "Friends."]],
    },
    button: {
      playful: [["C", "Hey! Can I join too?"]],
      heartfelt: [["A", "Best day ever."]],
      witty: [["A", "Same time tomorrow?"]],
      minimal: [["A", "Heh."]],
    },
  };
  const lines = L[beat][style] ?? L[beat].playful ?? [];
  return lines
    .filter(([who]) => (who === "B" ? !!c.B : who === "C" ? !!c.C : true))
    .map(([who, text]) => ({ speaker: who === "A" ? c.A.name : who === "B" ? c.B!.name : c.C!.name, text: fill(text, c) }));
}

function sceneFor(c: Ctx, beat: Beat, i: number, n: number, duration: number): StoryScene {
  const { A, B } = c;
  const both = B ? [A.name, B.name] : [A.name];
  const narrate = c.s.narratorStyle !== "none";
  const genre = c.s.genre;
  const emo = {
    wholesome: ["hopeful", "tender", "determined", "brave", "joyful", "cozy"],
    funny: ["deadpan", "panicked", "frantic", "smug", "triumphant", "silly"],
    emotional: ["lonely", "fragile", "heartbroken", "courageous", "overwhelmed with joy", "peaceful"],
    adventure: ["curious", "excited", "daring", "breathless", "victorious", "proud"],
    mystery: ["suspicious", "uneasy", "tense", "startled", "relieved", "amused"],
    twist: ["calm", "puzzled", "worried", "shocked", "delighted", "knowing"],
    drama: ["confident", "flirty", "jealous", "shocked", "triumphant", "smug"],
  }[genre];
  const emotion = emo[Math.min(emo.length - 1, Math.floor((i / Math.max(1, n - 1)) * (emo.length - 1)))];

  const T: Record<Beat, () => Omit<StoryScene, "beat" | "durationSec" | "dialogue" | "emotion">> = {
    hook: () => ({
      visual: fill(`Extreme close-up of {A}'s huge glossy eyes blinking, reflecting {light}; the camera pulls back to reveal {A}, a ${A.adj} {fa}, sitting alone on {place}.`, c),
      camera: "Slow dolly-out from an extreme close-up to a medium shot, shallow depth of field",
      characters: [A.name],
      action: fill(`{A} looks around, sighs, then perks up at a tiny sound off-screen.`, c),
      narration: narrate ? fill(pick(c.rnd, NARR_HOOK[genre]), c) : "",
      sfx: genre === "mystery" ? ["tick", "heartbeat"] : genre === "funny" ? ["boing"] : ["sparkle"],
      caption: fill(pick(c.rnd, NARR_HOOK[genre]), c).split(/[.…]/)[0].slice(0, 60),
    }),
    setup: () => ({
      visual: B
        ? fill(`{A} peeks around a sugar bowl and discovers {B}, a ${B.adj} {fb}, trembling in the shadows of {place}.`, c)
        : fill(`{A} explores {place}, eyes wide with wonder, as {light} catches every detail.`, c),
      camera: pick(c.rnd, ["Low-angle tracking shot at fruit height, gentle push-in", "Over-the-shoulder shot from behind {A}, rack focus to the discovery"]).replace("{A}", A.name),
      characters: both,
      action: B ? fill(`{A} slowly approaches; {B} flinches, then looks up with hopeful eyes.`, c) : fill(`{A} takes a brave first step forward.`, c),
      narration: narrate && B ? fill(`That's when {A} met {B}.`, c) : "",
      sfx: ["squeak"],
      caption: B ? fill(`{A} finds {B}`, c) : fill(`{A} sets off`, c),
    }),
    conflict: () => ({
      visual: fill(`Wide shot: the problem is clear—{problem}. The edge of {place} looms like a cliff; {A} and {B} look tiny against it.`, c),
      camera: "Wide establishing shot, then a quick whip-pan to the characters' worried faces",
      characters: both,
      action: fill(`{A} tries the obvious way and fails comically, bouncing back with a squish.`, c),
      narration: narrate ? fill(pick(c.rnd, [`But there was a problem: {problem}.`, `It wasn't going to be easy.`]), c) : "",
      sfx: genre === "funny" ? ["boing", "thud"] : ["whoosh", "thud"],
      caption: cap(c.problem).slice(0, 70),
    }),
    turn: () => ({
      visual: fill(`{A} spots something clever—a spoon balanced like a seesaw—and a lightbulb moment lights up {A}'s face as {light} flares behind them.`, c),
      camera: "Snap zoom onto {A}'s face, then a smooth orbit around the improvised plan".replace("{A}", A.name),
      characters: both,
      action: fill(`{A} grabs {B}'s little hand; together they launch off the spoon in slow motion.`, c),
      narration: narrate ? fill(`So {A} decided to ${c.goal}.`, c) : "",
      sfx: ["ding", "whoosh"],
      caption: fill(`{A} has a plan!`, c),
    }),
    payoff: () => ({
      visual: fill(`{A} and {B} land safely and tumble into a giggling hug; {light} wraps them in a warm glow, tiny sparkles floating in the air.`, c),
      camera: "Slow-motion landing, then a gentle crane-up to a warm two-shot",
      characters: both,
      action: fill(`{B} squeezes {A} tight; {A}'s cheeks blush and both beam with joy.`, c),
      narration: narrate ? fill(pick(c.rnd, [`And just like that, {A} wasn't lonely anymore.`, `Sometimes the smallest friend makes the biggest difference.`]), c) : "",
      sfx: ["pop", "sparkle", "chime"],
      caption: B ? fill(`{A} + {B} = friends`, c) : fill(`{A} did it!`, c),
    }),
    button: () => ({
      visual: c.C
        ? fill(`Final beat: as {A} and {B} sit side by side, {C} rolls in with a hopeful grin and a little wave.`, c)
        : fill(`Final beat: {A} and {B} sit side by side watching the light change, then {B} gives a tiny surprised hiccup that makes them both laugh.`, c),
      camera: "Locked-off wide shot, slight push-in for the final reaction",
      characters: c.C ? [...both, c.C.name] : both,
      action: "A last comedic or heartwarming reaction before cut to black.",
      narration: "",
      sfx: ["pop"],
      caption: c.C ? fill(`…and then came {C}`, c) : "Best friends",
    }),
  };
  const base = genre === "drama" ? dramaScene(c, beat, both) : T[beat]();
  const dialogue = genre === "drama" ? dramaDialogue(c, beat) : dialogueFor(c, beat);
  // Keep speech inside the shot (~2.4 words/s plus breathing room). Dialogue wins over narration,
  // except on the hook where the narrator line *is* the hook.
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const budget = (duration - 0.6) * 2.4;
  const dWords = dialogue.reduce((a, d) => a + words(d.text), 0);
  if (base.narration && dWords + words(base.narration) > budget) {
    if (beat === "hook") while (dialogue.length && dialogue.reduce((a, d) => a + words(d.text), 0) + words(base.narration) > budget) dialogue.pop();
    else base.narration = "";
  }
  while (dialogue.length > 1 && dialogue.reduce((a, d) => a + words(d.text), 0) > budget) dialogue.pop();
  return { beat, durationSec: duration, emotion, dialogue, ...base };
}

/* ------------------------- Villa drama (reality show) ------------------------- */

function dramaScene(c: Ctx, beat: Beat, both: string[]): Omit<StoryScene, "beat" | "durationSec" | "dialogue" | "emotion"> {
  const narrate = c.s.narratorStyle !== "none";
  const C = c.C;
  const rival = C ? C.name : "the others";
  const trio = C ? [...both, C.name] : both;
  const T: Record<Beat, () => Omit<StoryScene, "beat" | "durationSec" | "dialogue" | "emotion">> = {
    hook: () => ({
      visual: fill(`{A} struts across {place} in slow motion, takes off their sunglasses and smirks; everyone lounging by the pool turns to stare.`, c),
      camera: "Low-angle slow-motion tracking shot, then a snap zoom onto {A}'s face".replace("{A}", c.A.name),
      characters: [c.A.name],
      action: fill(`{A} flips their sunglasses up and gives a confident wink.`, c),
      narration: narrate ? fill(pick(c.rnd, NARR_HOOK.drama), c) : "",
      sfx: ["whoosh", "ding"],
      caption: "Day 1 in the villa",
    }),
    setup: () => ({
      visual: c.B ? fill(`{A} and {B} share a sun lounger by the sparkling pool, laughing and leaning close${C ? `, while ${C.name} watches from the bar, sipping a smoothie` : ""}.`, c) : fill(`{A} poses at the edge of the pool while the others whisper.`, c),
      camera: "Medium two-shot, slow push-in, then a quick cut-away glance".trim(),
      characters: trio,
      action: c.B ? fill(`{B} giggles at {A}'s joke and plays with their hair.`, c) : fill(`{A} checks their reflection in the pool.`, c),
      narration: narrate && c.B ? fill(`And {A} has eyes on {B}.`, c) : "",
      sfx: ["sparkle"],
      caption: c.B ? fill(`{A} + {B}?`, c) : fill(`{A} is ready`, c),
    }),
    conflict: () => ({
      visual: C ? fill(`{C} storms over to the lounger, arms crossed, glaring at {A}; the other islanders gasp and lower their drinks.`, c) : fill(`A rival walks in and everyone gasps.`, c),
      camera: "Whip-pan to the rival, then dramatic close-ups on shocked faces",
      characters: trio,
      action: fill(`${rival} points accusingly; {A} raises an eyebrow, unbothered.`, c),
      narration: narrate ? fill(`But {problem}.`, c) : "",
      sfx: ["thud", "heartbeat"],
      caption: C ? `${C.name} is NOT happy` : "Uh oh",
    }),
    turn: () => ({
      visual: fill(`A phone buzzes on the table: everyone crowds around to read the text. Close-ups of wide eyes and dropped jaws.`, c),
      camera: "Insert shot of the phone screen (blank glow, no readable text), then fast cuts between reaction close-ups",
      characters: trio,
      action: fill(`{B} reads it, looks at {A}, then at ${rival}.`, c),
      narration: narrate ? `Then came the text. Recoupling. Tonight.` : "",
      sfx: ["ding", "drumroll"],
      caption: "Recoupling tonight",
    }),
    payoff: () => ({
      visual: fill(`At the glowing fire pit at night, {B} stands up, takes a breath and steps toward {A}; {A} grins as ${rival} gasps.`, c),
      camera: "Slow dolly in on {B}, reverse shot to {A}'s reaction, wide shot of the group".replace("{B}", c.B?.name ?? c.A.name).replace("{A}", c.A.name),
      characters: trio,
      action: fill(`{B} takes {A}'s hand; the islanders cheer.`, c),
      narration: "",
      sfx: ["drumroll", "chime"],
      caption: c.B ? fill(`{B} picks {A}!`, c) : `${c.A.name} wins`,
    }),
    button: () => ({
      visual: C ? fill(`Close-up: {C}, alone by the pool, slowly lowers their sunglasses and looks straight into the camera with a sly smile.`, c) : fill(`{A} winks at the camera as the pool lights glow.`, c),
      camera: "Locked-off close-up, tiny push-in",
      characters: [C ? C.name : c.A.name],
      action: "A knowing look straight down the lens.",
      narration: "",
      sfx: ["pop"],
      caption: "To be continued…",
    }),
  };
  return T[beat]();
}

function dramaDialogue(c: Ctx, beat: Beat): DialogueLine[] {
  if (c.s.dialogueStyle === "no-dialogue") return [];
  const lines: Record<Beat, [string, string][]> = {
    hook: [["A", "Did someone order trouble?"]],
    setup: [["A", "So… is this seat taken?"], ["B", "It is now."]],
    conflict: [["C", "Excuse me? That's MY lounger."], ["A", "Not anymore, babe."]],
    turn: [["B", "Oh no. Oh no no no."]],
    payoff: [["B", "I choose… {A}."]],
    button: [["C", "This isn't over."]],
  };
  return lines[beat]
    .filter(([who]) => (who === "B" ? !!c.B : who === "C" ? !!c.C : true))
    .map(([who, text]) => ({ speaker: who === "A" ? c.A.name : who === "B" ? c.B!.name : c.C!.name, text: fill(text, c) }));
}

export function composeLocalStory(settings: StorySettings, variation = 0): Story {
  const rnd = seededRng(`${settings.idea}|${settings.genre}|${variation}`);
  const idea = settings.idea;
  const found = findFruits(idea);
  const defaults = settings.genre === "drama" || isHumanoidStyle(settings.visualStyle) ? ["strawberry", "banana", "watermelon", "pear"] : ["strawberry", "orange", "blueberry", "pineapple"];
  const fruitsWanted = Math.max(1, Math.min(4, settings.characterCount));
  const castInfo: { fruit: string; adj: string }[] = [];
  for (const f of found) {
    if (castInfo.length >= fruitsWanted) break;
    if (castInfo.some((x) => x.fruit === f.fruit)) continue;
    castInfo.push({ fruit: f.fruit, adj: f.adjectives.join(" ") });
  }
  for (const d of defaults) {
    if (castInfo.length >= fruitsWanted) break;
    if (!castInfo.some((x) => x.fruit === d)) castInfo.push({ fruit: d, adj: castInfo.length === 1 ? "curious little" : "wise old" });
  }
  const usedNames = new Set<string>();
  const cast: Cast[] = castInfo.map((ci, i) => {
    const info = fruitInfo(ci.fruit);
    const names = info.names.filter((n) => !usedNames.has(n));
    const name = names.length ? names[Math.floor(rnd() * names.length)] : `${cap(ci.fruit)} ${i + 1}`;
    usedNames.add(name);
    return { name, fruit: info.key, adj: ci.adj || (i === 0 ? "cheerful" : "tiny"), he: "they" };
  });
  const [A, B, C] = cast;
  const lower = idea.toLowerCase();
  const setting = SETTINGS.find((s) => s.kw.test(lower)) ?? GENRE_DEFAULT_SETTING[settings.genre];
  const ctx: Ctx = { A, B, C, place: setting.place, light: setting.light, goal: extractGoal(idea, A, B), problem: problemFor(B, settings.genre), s: settings, rnd };

  const beats = beatPlan(settings.sceneCount);
  const durations = allocateDurations(beats, settings.durationSec);
  const scenes = beats.map((b, i) => sceneFor(ctx, b, i, beats.length, durations[i]));

  const title = settings.genre === "drama" && B ? pick(rnd, [`Villa Drama: ${A.name} vs ${C?.name ?? B.name}`, `${B.name} Has to Choose`, `${A.name} Enters the Villa`]) : B ? pick(rnd, [`${A.name} and the ${B.adj ? cap(B.adj.split(" ").pop()!) + " " : ""}${cap(B.fruit)}`, `${A.name} Meets ${B.name}`, `The Day ${A.name} Found ${B.name}`]) : `${A.name}'s Big Day`;

  return {
    title,
    logline: cap(idea.replace(/\s+/g, " ").trim()),
    hook: scenes[0].narration || scenes[0].caption,
    characters: cast.map((c, i) => ({
      name: c.name,
      fruit: c.fruit,
      appearance: describeAppearance(c.fruit, c.adj, i, settings.visualStyle),
      personality: settings.genre === "drama" ? (["confident, flirty and a little chaotic", "charming, indecisive and sweet", "competitive, dramatic and iconic", "chill, funny, the villa's peacemaker"][i] ?? "dramatic") : traitFor(c.adj.split(" ").pop() ?? "", i === 0 ? "warm-hearted, curious and brave when it counts" : i === 1 ? "sweet, a little nervous, very loyal" : "funny, wise and full of surprises"),
      voiceHint: i === 0 ? "bright, gentle" : i === 1 ? "tiny, high, sweet" : "warm, slightly deeper",
    })),
    scenes,
    description: `${cap(idea.trim().replace(/\.?$/, "."))} A ${settings.durationSec}-second ${settings.genre} 3D animated fruit short.`,
  };
}

const ACCESSORIES = ["a tiny knitted scarf", "a little leaf-shaped backpack", "a small polka-dot bow", "a tiny backwards cap", "round little glasses", "a red ribbon around the stem"];

const OUTFITS = ["a crisp white linen shirt and tailored shorts", "a flowing coral sundress", "a lime-green resort co-ord set", "a black tank top and patterned board shorts"];

export function describeAppearance(fruit: string, adj: string, index: number, style = "3d family film") {
  const info = fruitInfo(fruit);
  if (isHumanoidStyle(style)) {
    return `A stylish adult with a realistic human body, natural skin and normal human proportions, whose head is a glossy photoreal ${info.key} with ${info.skin}; a human-like face sculpted into the fruit with big expressive eyes, defined eyebrows, a small nose and full lips; wearing ${OUTFITS[index % OUTFITS.length]}.`;
  }
  const size = /tiny|little|small/.test(adj) ? "tiny, palm-sized" : /old|big|giant/.test(adj) ? "plump, slightly larger" : "small, rounded";
  return `A ${size} ${info.key} character with ${info.skin}; huge expressive glossy eyes with sparkly highlights, soft rosy cheeks, a small expressive mouth, short noodle-like arms and stubby legs, wearing ${ACCESSORIES[index % ACCESSORIES.length]}.`;
}
