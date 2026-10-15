import { route, readJson } from "@/lib/api";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { listProviders } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export const GET = route(async () => ({ settings: getSettings(), defaults: DEFAULT_SETTINGS, providers: listProviders() }));

export const PUT = route(async (req) => ({ settings: saveSettings(await readJson(req)) }));
