/** Visual knowledge about fruits, used for character design, sketches and prompts. */
export interface FruitInfo {
  key: string;
  colors: string[]; // sketch palette: body, accent(leaf/stem), highlight
  skin: string; // texture description used in prompts
  shape: "round" | "tall" | "drop" | "long" | "small" | "oval" | "heart";
  names: string[];
}

export const FRUITS: FruitInfo[] = [
  { key: "strawberry", colors: ["#e8384f", "#3fa34d", "#ffd3da"], skin: "glossy ruby-red skin dotted with tiny golden seeds and a perky green leafy crown", shape: "heart", names: ["Berry", "Rosie", "Ruby", "Scarlett"] },
  { key: "orange", colors: ["#ff8c1a", "#3fa34d", "#ffd59e"], skin: "dimpled, sun-bright orange peel with a tiny green stem leaf", shape: "round", names: ["Pip", "Sunny", "Clemmie", "Tango"] },
  { key: "tangerine", colors: ["#ff7a1a", "#3fa34d", "#ffd59e"], skin: "soft dimpled tangerine peel with a little leaf", shape: "round", names: ["Tiny", "Mandy", "Zest"] },
  { key: "clementine", colors: ["#ff8a22", "#3fa34d", "#ffd59e"], skin: "smooth little clementine peel with a leaf on top", shape: "small", names: ["Clem", "Pippa", "Dot"] },
  { key: "lemon", colors: ["#ffe14d", "#4caf50", "#fff7c2"], skin: "bright yellow, slightly bumpy lemon peel with pointed ends", shape: "oval", names: ["Zesty", "Lemmy", "Sol"] },
  { key: "lime", colors: ["#7fd14a", "#2f7d32", "#e3f7c8"], skin: "glossy lime-green peel", shape: "oval", names: ["Limo", "Kiki", "Jade"] },
  { key: "apple", colors: ["#d93636", "#6b3e1e", "#ffd6d6"], skin: "shiny crisp red apple skin with a brown stem and one green leaf", shape: "round", names: ["Appy", "Crunch", "Mac"] },
  { key: "banana", colors: ["#ffd84a", "#6b4f1e", "#fff3b0"], skin: "smooth curved yellow banana peel with a brown tip", shape: "long", names: ["Bobo", "Nana", "Split"] },
  { key: "blueberry", colors: ["#4a5fd1", "#2b2f6b", "#c9d1ff"], skin: "dusky blue velvety blueberry skin with a tiny star-shaped crown", shape: "small", names: ["Blu", "Bibi", "Boo"] },
  { key: "grape", colors: ["#8e44ad", "#3fa34d", "#e2c6f0"], skin: "translucent glossy purple grape skin", shape: "small", names: ["Gigi", "Vino", "Pluck"] },
  { key: "cherry", colors: ["#c0122f", "#3fa34d", "#ffc2cc"], skin: "deep glossy cherry-red skin with a long green stem", shape: "round", names: ["Cheri", "Bing", "Coco"] },
  { key: "peach", colors: ["#ffab7a", "#3fa34d", "#ffe1cf"], skin: "soft fuzzy peach skin blushing from gold to pink", shape: "heart", names: ["Peaches", "Fuzz", "Georgia"] },
  { key: "pear", colors: ["#b5d84a", "#6b4f1e", "#eef7c8"], skin: "speckled green-gold pear skin with a curved stem", shape: "drop", names: ["Perry", "Bartlett", "Pearl"] },
  { key: "pineapple", colors: ["#f2b632", "#2f8f3a", "#ffe9a8"], skin: "golden diamond-patterned pineapple skin with a spiky green crown", shape: "tall", names: ["Spike", "Pina", "Hula"] },
  { key: "watermelon", colors: ["#3a9a48", "#1f5e2a", "#ff6b81"], skin: "striped dark-and-light green watermelon rind", shape: "oval", names: ["Melly", "Wally", "Big Mel"] },
  { key: "mango", colors: ["#ffb02e", "#e2453c", "#ffe2a3"], skin: "smooth mango skin glowing from green to sunset orange-red", shape: "drop", names: ["Mango", "Mimi", "Tropi"] },
  { key: "kiwi", colors: ["#8a6a3a", "#7fd14a", "#e6f5b8"], skin: "fuzzy brown kiwi skin", shape: "oval", names: ["Kiwi", "Fuzzy", "Koko"] },
  { key: "coconut", colors: ["#7a5232", "#f5f0e6", "#c9a37a"], skin: "hairy brown coconut shell", shape: "round", names: ["Coco", "Nut", "Captain Husk"] },
  { key: "avocado", colors: ["#3f6b2a", "#c9e27a", "#8a5a2b"], skin: "bumpy dark green avocado skin", shape: "drop", names: ["Avo", "Guac", "Holly"] },
  { key: "plum", colors: ["#6a2c70", "#3fa34d", "#d9b3e0"], skin: "dusky violet plum skin with a soft bloom", shape: "round", names: ["Plumy", "Damson", "Violet"] },
  { key: "raspberry", colors: ["#e0325f", "#3fa34d", "#ffc2d4"], skin: "bumpy, jewel-like raspberry drupelets", shape: "small", names: ["Razz", "Bella", "Bramble"] },
  { key: "blackberry", colors: ["#2c1a3b", "#3fa34d", "#8a6aa8"], skin: "glossy bumpy blackberry drupelets", shape: "small", names: ["Blackie", "Thorn", "Midnight"] },
  { key: "pomegranate", colors: ["#b3202f", "#7a1420", "#ffb3bd"], skin: "leathery ruby pomegranate skin with a little crown", shape: "round", names: ["Pom", "Garnet", "Granny Pom"] },
  { key: "fig", colors: ["#6b3a5e", "#3fa34d", "#e8b4a0"], skin: "soft purple fig skin", shape: "drop", names: ["Figgy", "Newton"] },
  { key: "apricot", colors: ["#ffa34d", "#3fa34d", "#ffdcb3"], skin: "velvety apricot skin", shape: "round", names: ["Apri", "Goldie"] },
  { key: "melon", colors: ["#d9c25a", "#8aa83a", "#fff0b0"], skin: "netted cantaloupe rind", shape: "round", names: ["Melo", "Honey"] },
  { key: "grapefruit", colors: ["#ff8a6a", "#3fa34d", "#ffd3c4"], skin: "pink-blushed grapefruit peel", shape: "round", names: ["Gus", "Rosa"] },
  { key: "dragonfruit", colors: ["#ff3d8f", "#7fd14a", "#ffd1e6"], skin: "hot-pink dragon fruit skin with green-tipped flame scales", shape: "oval", names: ["Draco", "Pinky"] },
  { key: "papaya", colors: ["#ff9a3d", "#5aa83a", "#ffd6a8"], skin: "smooth orange-gold papaya skin", shape: "drop", names: ["Papi", "Paya"] },
  { key: "passionfruit", colors: ["#5a2a5e", "#3fa34d", "#d9a0e0"], skin: "wrinkled purple passion fruit shell", shape: "round", names: ["Passi", "Pash"] },
];

const ALIASES: Record<string, string> = {
  strawberries: "strawberry",
  oranges: "orange",
  lemons: "lemon",
  limes: "lime",
  apples: "apple",
  bananas: "banana",
  blueberries: "blueberry",
  grapes: "grape",
  cherries: "cherry",
  peaches: "peach",
  pears: "pear",
  pineapples: "pineapple",
  watermelons: "watermelon",
  mangoes: "mango",
  mangos: "mango",
  kiwis: "kiwi",
  coconuts: "coconut",
  avocados: "avocado",
  plums: "plum",
  raspberries: "raspberry",
  blackberries: "blackberry",
  figs: "fig",
  cantaloupe: "melon",
  "dragon fruit": "dragonfruit",
  "passion fruit": "passionfruit",
};

export function fruitInfo(name: string): FruitInfo {
  const k = name.toLowerCase().trim();
  return FRUITS.find((f) => f.key === (ALIASES[k] ?? k)) ?? { key: k || "fruit", colors: ["#ff8f5a", "#3fa34d", "#ffe1cf"], skin: `smooth ${k || "fruit"} skin`, shape: "round", names: ["Buddy", "Sprout"] };
}

/** Find fruit mentions in order, with up to two preceding descriptive words. */
export function findFruits(text: string): { fruit: string; adjectives: string[]; index: number }[] {
  const lower = text.toLowerCase();
  const keys = [...FRUITS.map((f) => f.key), ...Object.keys(ALIASES)].sort((a, b) => b.length - a.length);
  const found: { fruit: string; adjectives: string[]; index: number }[] = [];
  const taken: [number, number][] = [];
  for (const k of keys) {
    const re = new RegExp(`\\b${k.replace(/ /g, "\\s+")}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      const s = m.index;
      const e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      const before = lower.slice(Math.max(0, s - 40), s).replace(/[^a-z\s-]/g, " ").trim().split(/\s+/).filter(Boolean);
      const adjectives: string[] = [];
      for (let i = before.length - 1; i >= 0 && adjectives.length < 2; i--) {
        const w = before[i];
        if (STOP.has(w)) break;
        adjectives.unshift(w);
      }
      found.push({ fruit: ALIASES[k] ?? k, adjectives, index: s });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

const STOP = new Set(
  "a an the and or but to of in on at with for from by finds find found meets meet met sees see saw helps help helped who that this is was are were his her their its it my your our decides decide wants want tries try one two three some".split(" "),
);
