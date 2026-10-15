import "server-only";
import os from "node:os";
import path from "node:path";

/** Server-side configuration. Never import this from client components. */
function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  get dataDir() {
    // Outside the project folder by default so the dev server's file watcher
    // does not reload the app every time a clip or the database is written.
    return path.resolve(env("DATA_DIR") ?? path.join(os.homedir(), ".fruit-shorts-studio"));
  },
  get forceDemo() {
    return env("DEMO_MODE") === "true";
  },
  luma: {
    get apiKey() {
      return env("LUMA_API_KEY");
    },
    get baseUrl() {
      return env("LUMA_BASE_URL") ?? "https://api.lumalabs.ai/dream-machine/v1";
    },
  },
  get publicBaseUrl() {
    return env("PUBLIC_BASE_URL")?.replace(/\/+$/, "");
  },
  anthropic: {
    get apiKey() {
      return env("ANTHROPIC_API_KEY");
    },
    get model() {
      return env("ANTHROPIC_MODEL") ?? "claude-opus-5-5";
    },
  },
  openaiCompat: {
    get baseUrl() {
      return env("OPENAI_COMPAT_BASE_URL")?.replace(/\/+$/, "");
    },
    get model() {
      return env("OPENAI_COMPAT_MODEL");
    },
    get apiKey() {
      return env("OPENAI_COMPAT_API_KEY");
    },
  },
  piper: {
    get bin() {
      return env("PIPER_BIN");
    },
    get voicesDir() {
      return env("PIPER_VOICES_DIR");
    },
  },
};

/** Values that must never appear in logs or API responses. */
export function secretValues(): string[] {
  return [config.luma.apiKey, config.anthropic.apiKey, config.openaiCompat.apiKey].filter(
    (v): v is string => !!v && v.length >= 6,
  );
}
