import { route, readJson } from "@/lib/api";
import { createCharacter, listCharacters } from "@/lib/repo";
import { CharacterInputSchema } from "@/lib/types";
import { fruitInfo } from "@/lib/story/fruits";
import { describeAppearance } from "@/lib/story/local";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => ({ characters: listCharacters(new URL(req.url).searchParams.get("q")?.slice(0, 60) || undefined) }));

export const POST = route(async (req) => {
  const raw = (await readJson(req)) as Record<string, unknown>;
  const fruit = String(raw.fruit ?? "");
  const info = fruitInfo(fruit);
  const input = CharacterInputSchema.parse({
    palette: info.colors.slice(0, 3),
    appearance: fruit ? describeAppearance(info.key, "", 0) : "",
    ...raw,
  });
  return { character: createCharacter(input) };
});
