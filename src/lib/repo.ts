import "server-only";
import fs from "node:fs";
import { db, now, parseJson } from "./db";
import { fromRel, mediaUrl, newId } from "./paths";
import {
  CharacterInputSchema,
  StorySceneSchema,
  type ApprovalState,
  type CharacterInput,
  type ShortsContent,
  type Story,
  type StoryScene,
  type StorySettings,
} from "./types";

/* -------------------------------- Projects -------------------------------- */

export interface ProjectRow {
  id: string;
  title: string;
  idea: string;
  status: string;
  settings_json: string;
  story_json: string | null;
  content_json: string | null;
  script_approved: number;
  budget_usd: number | null;
  archived: number;
  created_at: number;
  updated_at: number;
}

export interface Project {
  id: string;
  title: string;
  idea: string;
  status: string;
  settings: StorySettings;
  story: Story | null;
  content: ShortsContent | null;
  scriptApproved: boolean;
  budgetUsd: number | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    title: r.title,
    idea: r.idea,
    status: r.status,
    settings: parseJson(r.settings_json, {} as StorySettings),
    story: parseJson<Story | null>(r.story_json, null),
    content: parseJson<ShortsContent | null>(r.content_json, null),
    scriptApproved: !!r.script_approved,
    budgetUsd: r.budget_usd,
    archived: !!r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createProject(settings: StorySettings, title?: string): Project {
  const id = newId("p_");
  const t = now();
  const name = title?.trim() || deriveTitle(settings.idea);
  db()
    .prepare("INSERT INTO projects(id,title,idea,status,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, name, settings.idea, "draft", JSON.stringify(settings), t, t);
  return getProject(id)!;
}

function deriveTitle(idea: string) {
  const words = idea.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 7).join(" ");
  return words.length ? words[0].toUpperCase() + words.slice(1) : "Untitled fruit story";
}

export function getProject(id: string): Project | null {
  const r = db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return r ? toProject(r) : null;
}

export function requireProject(id: string): Project {
  const p = getProject(id);
  if (!p) throw new NotFoundError("Project not found");
  return p;
}

export function listProjects(opts: { q?: string; status?: string; archived?: boolean } = {}): Project[] {
  const where: string[] = ["archived = ?"];
  const args: unknown[] = [opts.archived ? 1 : 0];
  if (opts.q) {
    where.push("(title LIKE ? OR idea LIKE ?)");
    args.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  if (opts.status) {
    where.push("status = ?");
    args.push(opts.status);
  }
  const rows = db().prepare(`SELECT * FROM projects WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT 500`).all(...args) as ProjectRow[];
  return rows.map(toProject);
}

export function updateProject(
  id: string,
  patch: Partial<{ title: string; status: string; settings: StorySettings; story: Story | null; content: ShortsContent | null; scriptApproved: boolean; budgetUsd: number | null; archived: boolean }>,
) {
  const sets: string[] = [];
  const args: unknown[] = [];
  const map: Record<string, [string, (v: never) => unknown]> = {
    title: ["title", (v) => v],
    status: ["status", (v) => v],
    settings: ["settings_json", (v) => JSON.stringify(v)],
    story: ["story_json", (v) => (v ? JSON.stringify(v) : null)],
    content: ["content_json", (v) => (v ? JSON.stringify(v) : null)],
    scriptApproved: ["script_approved", (v) => (v ? 1 : 0)],
    budgetUsd: ["budget_usd", (v) => v],
    archived: ["archived", (v) => (v ? 1 : 0)],
  };
  for (const [k, v] of Object.entries(patch)) {
    const m = map[k];
    if (!m || v === undefined) continue;
    sets.push(`${m[0]} = ?`);
    args.push(m[1](v as never));
  }
  if (!sets.length) return getProject(id);
  sets.push("updated_at = ?");
  args.push(now(), id);
  db().prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  return getProject(id);
}

export function touchProject(id: string) {
  db().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now(), id);
}

export function deleteProject(id: string) {
  const assets = db().prepare("SELECT path FROM assets WHERE project_id = ?").all(id) as { path: string }[];
  db().prepare("DELETE FROM projects WHERE id = ?").run(id);
  db().prepare("DELETE FROM jobs WHERE project_id = ?").run(id);
  for (const a of assets) safeUnlink(a.path);
}

/* --------------------------------- Scenes --------------------------------- */

export interface SceneRow {
  id: string;
  project_id: string;
  idx: number;
  data_json: string;
  storyboard_asset_id: string | null;
  clip_asset_id: string | null;
  approval: ApprovalState;
  created_at: number;
  updated_at: number;
}

export interface Scene extends StoryScene {
  id: string;
  projectId: string;
  idx: number;
  storyboardAssetId: string | null;
  clipAssetId: string | null;
  approval: ApprovalState;
}

export function toScene(r: SceneRow): Scene {
  const data = StorySceneSchema.parse(parseJson(r.data_json, {}));
  return { ...data, id: r.id, projectId: r.project_id, idx: r.idx, storyboardAssetId: r.storyboard_asset_id, clipAssetId: r.clip_asset_id, approval: r.approval };
}

export function listScenes(projectId: string): Scene[] {
  return (db().prepare("SELECT * FROM scenes WHERE project_id = ? ORDER BY idx").all(projectId) as SceneRow[]).map(toScene);
}

export function getScene(id: string): Scene | null {
  const r = db().prepare("SELECT * FROM scenes WHERE id = ?").get(id) as SceneRow | undefined;
  return r ? toScene(r) : null;
}

export function requireScene(id: string, projectId?: string): Scene {
  const s = getScene(id);
  if (!s || (projectId && s.projectId !== projectId)) throw new NotFoundError("Scene not found");
  return s;
}

/** Replace all scenes of a project with the story's scenes (used when a new story is generated). */
export function replaceScenes(projectId: string, scenes: StoryScene[]) {
  const t = now();
  const ins = db().prepare("INSERT INTO scenes(id,project_id,idx,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?)");
  db().transaction(() => {
    db().prepare("DELETE FROM scenes WHERE project_id = ?").run(projectId);
    scenes.forEach((s, i) => ins.run(newId("s_"), projectId, i, JSON.stringify(StorySceneSchema.parse(s)), t, t));
  })();
}

export function updateSceneData(id: string, patch: Partial<StoryScene>) {
  const cur = requireScene(id);
  const { id: _i, projectId: _p, idx: _x, storyboardAssetId: _s, clipAssetId: _c, approval: _a, ...data } = cur;
  const next = StorySceneSchema.parse({ ...data, ...patch });
  db().prepare("UPDATE scenes SET data_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(next), now(), id);
  touchProject(cur.projectId);
  return getScene(id)!;
}

export function setSceneFields(id: string, f: Partial<{ storyboardAssetId: string | null; clipAssetId: string | null; approval: ApprovalState }>) {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (f.storyboardAssetId !== undefined) (sets.push("storyboard_asset_id = ?"), args.push(f.storyboardAssetId));
  if (f.clipAssetId !== undefined) (sets.push("clip_asset_id = ?"), args.push(f.clipAssetId));
  if (f.approval !== undefined) (sets.push("approval = ?"), args.push(f.approval));
  if (!sets.length) return;
  sets.push("updated_at = ?");
  args.push(now(), id);
  db().prepare(`UPDATE scenes SET ${sets.join(", ")} WHERE id = ?`).run(...args);
}

export function reorderScenes(projectId: string, orderedIds: string[]) {
  const existing = listScenes(projectId).map((s) => s.id);
  if (existing.length !== orderedIds.length || existing.some((id) => !orderedIds.includes(id))) throw new ValidationError("Reorder list must contain every scene exactly once");
  const upd = db().prepare("UPDATE scenes SET idx = ?, updated_at = ? WHERE id = ? AND project_id = ?");
  db().transaction(() => orderedIds.forEach((id, i) => upd.run(i, now(), id, projectId)))();
  touchProject(projectId);
}

export function addScene(projectId: string, data: StoryScene, atIndex?: number) {
  const scenes = listScenes(projectId);
  if (scenes.length >= 12) throw new ValidationError("A project can have at most 12 scenes");
  const id = newId("s_");
  const idx = atIndex ?? scenes.length;
  db().transaction(() => {
    db().prepare("UPDATE scenes SET idx = idx + 1 WHERE project_id = ? AND idx >= ?").run(projectId, idx);
    db().prepare("INSERT INTO scenes(id,project_id,idx,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(id, projectId, idx, JSON.stringify(StorySceneSchema.parse(data)), now(), now());
  })();
  return getScene(id)!;
}

export function deleteScene(id: string) {
  const s = requireScene(id);
  db().transaction(() => {
    db().prepare("DELETE FROM scenes WHERE id = ?").run(id);
    db().prepare("UPDATE scenes SET idx = idx - 1 WHERE project_id = ? AND idx > ?").run(s.projectId, s.idx);
  })();
}

/* ------------------------------- Characters ------------------------------- */

export interface Character extends CharacterInput {
  id: string;
  approvedImageId: string | null;
  approvedImageUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

interface CharacterRow {
  id: string;
  name: string;
  fruit: string;
  data_json: string;
  approved_image_id: string | null;
  created_at: number;
  updated_at: number;
}

function toCharacter(r: CharacterRow): Character {
  const data = CharacterInputSchema.parse({ ...parseJson(r.data_json, {}), name: r.name, fruit: r.fruit });
  const img = r.approved_image_id ? getAsset(r.approved_image_id) : null;
  return { ...data, id: r.id, approvedImageId: r.approved_image_id, approvedImageUrl: img ? mediaUrl(img.path) : null, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function createCharacter(input: CharacterInput): Character {
  const c = CharacterInputSchema.parse(input);
  const id = newId("ch_");
  db().prepare("INSERT INTO characters(id,name,fruit,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(id, c.name, c.fruit, JSON.stringify(c), now(), now());
  return getCharacter(id)!;
}

export function getCharacter(id: string): Character | null {
  const r = db().prepare("SELECT * FROM characters WHERE id = ?").get(id) as CharacterRow | undefined;
  return r ? toCharacter(r) : null;
}

export function requireCharacter(id: string) {
  const c = getCharacter(id);
  if (!c) throw new NotFoundError("Character not found");
  return c;
}

export function listCharacters(q?: string): Character[] {
  const rows = q
    ? (db().prepare("SELECT * FROM characters WHERE name LIKE ? OR fruit LIKE ? ORDER BY updated_at DESC").all(`%${q}%`, `%${q}%`) as CharacterRow[])
    : (db().prepare("SELECT * FROM characters ORDER BY updated_at DESC").all() as CharacterRow[]);
  return rows.map(toCharacter);
}

export function updateCharacter(id: string, patch: Partial<CharacterInput>) {
  const cur = requireCharacter(id);
  const { id: _i, approvedImageId: _a, approvedImageUrl: _u, createdAt: _c, updatedAt: _up, ...data } = cur;
  const next = CharacterInputSchema.parse({ ...data, ...patch });
  db().prepare("UPDATE characters SET name=?, fruit=?, data_json=?, updated_at=? WHERE id=?").run(next.name, next.fruit, JSON.stringify(next), now(), id);
  return getCharacter(id)!;
}

export function setCharacterApprovedImage(id: string, assetId: string | null) {
  db().prepare("UPDATE characters SET approved_image_id = ?, updated_at = ? WHERE id = ?").run(assetId, now(), id);
}

export function deleteCharacter(id: string) {
  const assets = db().prepare("SELECT path FROM assets WHERE character_id = ? AND project_id IS NULL").all(id) as { path: string }[];
  db().prepare("DELETE FROM characters WHERE id = ?").run(id);
  db().prepare("DELETE FROM assets WHERE character_id = ? AND project_id IS NULL").run(id);
  for (const a of assets) safeUnlink(a.path);
}

export function linkCharacters(projectId: string, characterIds: string[]) {
  const ins = db().prepare("INSERT OR IGNORE INTO project_characters(project_id, character_id) VALUES (?,?)");
  db().transaction(() => characterIds.forEach((c) => ins.run(projectId, c)))();
}

export function unlinkCharacter(projectId: string, characterId: string) {
  db().prepare("DELETE FROM project_characters WHERE project_id = ? AND character_id = ?").run(projectId, characterId);
}

export function projectCharacters(projectId: string): Character[] {
  const rows = db()
    .prepare("SELECT c.* FROM characters c JOIN project_characters pc ON pc.character_id = c.id WHERE pc.project_id = ? ORDER BY c.created_at")
    .all(projectId) as CharacterRow[];
  return rows.map(toCharacter);
}

/* --------------------------------- Assets --------------------------------- */

export interface AssetRow {
  id: string;
  project_id: string | null;
  scene_id: string | null;
  character_id: string | null;
  kind: string;
  path: string;
  remote_url: string | null;
  provider: string;
  model: string | null;
  is_demo: number;
  approval: ApprovalState;
  meta_json: string;
  created_at: number;
}

export interface Asset {
  id: string;
  projectId: string | null;
  sceneId: string | null;
  characterId: string | null;
  kind: string;
  path: string;
  url: string;
  remoteUrl: string | null;
  provider: string;
  model: string | null;
  isDemo: boolean;
  approval: ApprovalState;
  meta: Record<string, unknown>;
  createdAt: number;
}

export function toAsset(r: AssetRow): Asset {
  return {
    id: r.id,
    projectId: r.project_id,
    sceneId: r.scene_id,
    characterId: r.character_id,
    kind: r.kind,
    path: r.path,
    url: mediaUrl(r.path)!,
    remoteUrl: r.remote_url,
    provider: r.provider,
    model: r.model,
    isDemo: !!r.is_demo,
    approval: r.approval,
    meta: parseJson(r.meta_json, {}),
    createdAt: r.created_at,
  };
}

export function createAsset(a: {
  projectId?: string | null;
  sceneId?: string | null;
  characterId?: string | null;
  kind: string;
  path: string;
  remoteUrl?: string | null;
  provider: string;
  model?: string | null;
  isDemo?: boolean;
  approval?: ApprovalState;
  meta?: Record<string, unknown>;
}): Asset {
  const id = newId("a_");
  db()
    .prepare("INSERT INTO assets(id,project_id,scene_id,character_id,kind,path,remote_url,provider,model,is_demo,approval,meta_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, a.projectId ?? null, a.sceneId ?? null, a.characterId ?? null, a.kind, a.path, a.remoteUrl ?? null, a.provider, a.model ?? null, a.isDemo ? 1 : 0, a.approval ?? "pending", JSON.stringify(a.meta ?? {}), now());
  return getAsset(id)!;
}

export function getAsset(id: string): Asset | null {
  const r = db().prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow | undefined;
  return r ? toAsset(r) : null;
}

export function listAssets(f: { projectId?: string; sceneId?: string; characterId?: string; kind?: string }): Asset[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.projectId) (where.push("project_id = ?"), args.push(f.projectId));
  if (f.sceneId) (where.push("scene_id = ?"), args.push(f.sceneId));
  if (f.characterId) (where.push("character_id = ?"), args.push(f.characterId));
  if (f.kind) (where.push("kind = ?"), args.push(f.kind));
  const sql = `SELECT * FROM assets ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 500`;
  return (db().prepare(sql).all(...args) as AssetRow[]).map(toAsset);
}

export function setAssetApproval(id: string, approval: ApprovalState) {
  db().prepare("UPDATE assets SET approval = ? WHERE id = ?").run(approval, id);
}

export function updateAssetMeta(id: string, meta: Record<string, unknown>) {
  const a = getAsset(id);
  if (!a) return;
  db().prepare("UPDATE assets SET meta_json = ? WHERE id = ?").run(JSON.stringify({ ...a.meta, ...meta }), id);
}

export function deleteAsset(id: string) {
  const a = getAsset(id);
  if (!a) return;
  db().prepare("DELETE FROM assets WHERE id = ?").run(id);
  safeUnlink(a.path);
}

function safeUnlink(rel: string) {
  try {
    fs.unlinkSync(fromRel(rel));
  } catch {
    /* already gone */
  }
}

/* --------------------------------- Errors --------------------------------- */

export class NotFoundError extends Error {
  status = 404;
}
export class ValidationError extends Error {
  status = 400;
}
export class ConflictError extends Error {
  status = 409;
}
export class PaymentRequiredError extends Error {
  status = 402;
  constructor(message: string, public details?: unknown) {
    super(message);
  }
}
