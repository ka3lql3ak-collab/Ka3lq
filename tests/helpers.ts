import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Point the app at a fresh, isolated data directory. Call before importing app modules' DB use. */
export function freshDataDir(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fss-${name}-`));
  process.env.DATA_DIR = dir;
  process.env.DEMO_MODE = "";
  delete process.env.LUMA_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  return dir;
}
