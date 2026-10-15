/** Names of the built-in, procedurally synthesized (royalty-free) sound effects. */
export const SFX_NAMES = ["whoosh", "pop", "boing", "sparkle", "chime", "thud", "tick", "heartbeat", "rumble", "squeak", "rain", "wind", "chirp", "ding", "wahwah", "drumroll", "magic"] as const;
export type SfxName = (typeof SFX_NAMES)[number];

const KEYWORDS: [RegExp, SfxName][] = [
  [/whoosh|swoosh|swish|fly|zoom|whip/, "whoosh"],
  [/pop|plop|bubble/, "pop"],
  [/boing|bounce|spring|jump/, "boing"],
  [/sparkl|twinkl|shimmer|glitter|glow/, "sparkle"],
  [/chime|bell|wind chime/, "chime"],
  [/thud|bump|fall|crash|land|bonk|squish/, "thud"],
  [/tick|clock/, "tick"],
  [/heart/, "heartbeat"],
  [/rumbl|thunder|quake/, "rumble"],
  [/squeak|creak|step|footstep/, "squeak"],
  [/rain|drip|drop/, "rain"],
  [/wind|breeze|gust/, "wind"],
  [/chirp|bird|tweet/, "chirp"],
  [/ding|idea|lightbulb/, "ding"],
  [/wah|fail|sad trombone/, "wahwah"],
  [/drum/, "drumroll"],
  [/magic|spell|wand|poof/, "magic"],
];

/** Map a free-text SFX cue to a built-in effect, or null when nothing matches. */
export function matchSfx(cue: string): SfxName | null {
  const c = cue.toLowerCase().trim();
  if ((SFX_NAMES as readonly string[]).includes(c)) return c as SfxName;
  for (const [re, name] of KEYWORDS) if (re.test(c)) return name;
  return null;
}
