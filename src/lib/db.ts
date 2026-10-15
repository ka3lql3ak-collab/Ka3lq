import "server-only";
import Database from "better-sqlite3";
import path from "node:path";
import { dataDir } from "./paths";

/**
 * SQLite schema. Migrations are append-only: add a new entry, never edit an old one.
 */
const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    idea TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    settings_json TEXT NOT NULL,
    story_json TEXT,
    content_json TEXT,
    script_approved INTEGER NOT NULL DEFAULT 0,
    budget_usd REAL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fruit TEXT NOT NULL,
    data_json TEXT NOT NULL,
    approved_image_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE project_characters (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, character_id)
  );
  CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    storyboard_asset_id TEXT,
    clip_asset_id TEXT,
    approval TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX scenes_project ON scenes(project_id, idx);
  CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    scene_id TEXT,
    character_id TEXT,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    remote_url TEXT,
    provider TEXT NOT NULL,
    model TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    approval TEXT NOT NULL DEFAULT 'pending',
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX assets_owner ON assets(project_id, scene_id, kind);
  CREATE INDEX assets_char ON assets(character_id, kind);
  CREATE TABLE generations (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    scene_id TEXT,
    character_id TEXT,
    kind TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    params_json TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_job_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    estimated_cost REAL NOT NULL DEFAULT 0,
    actual_cost REAL,
    is_paid INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    approved_at INTEGER,
    asset_id TEXT,
    error TEXT,
    progress_url TEXT,
    poll_count INTEGER NOT NULL DEFAULT 0,
    next_poll_at INTEGER,
    submitted_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX generations_project ON generations(project_id, scene_id);
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    message TEXT,
    error TEXT,
    result_json TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    run_after INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX jobs_status ON jobs(status, run_after);
  CREATE TABLE cost_ledger (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    generation_id TEXT,
    provider TEXT NOT NULL,
    kind TEXT NOT NULL,
    estimated REAL NOT NULL DEFAULT 0,
    actual REAL,
    note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE renders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    quality TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    path TEXT,
    captions_path TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    approval TEXT NOT NULL DEFAULT 'pending',
    options_json TEXT NOT NULL DEFAULT '{}',
    duration_sec REAL,
    error TEXT,
    log TEXT,
    job_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    render_id TEXT NOT NULL,
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    srt_path TEXT,
    vtt_path TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    size_bytes INTEGER,
    duration_sec REAL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );
  `,
];

type GlobalWithDb = typeof globalThis & { __fruitDb?: Database.Database; __fruitDbPath?: string };

export function db(): Database.Database {
  const g = globalThis as GlobalWithDb;
  const file = path.join(dataDir(), "studio.sqlite");
  if (g.__fruitDb && g.__fruitDbPath === file) return g.__fruitDb;
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  migrate(conn);
  g.__fruitDb = conn;
  g.__fruitDbPath = file;
  return conn;
}

function migrate(conn: Database.Database) {
  const version = conn.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    conn.transaction(() => {
      conn.exec(MIGRATIONS[i]);
      conn.pragma(`user_version = ${i + 1}`);
    })();
  }
}

/** For tests: close and forget the current connection. */
export function closeDb() {
  const g = globalThis as GlobalWithDb;
  g.__fruitDb?.close();
  g.__fruitDb = undefined;
  g.__fruitDbPath = undefined;
}

export const now = () => Date.now();

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
