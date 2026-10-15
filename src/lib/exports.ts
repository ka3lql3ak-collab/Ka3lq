import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, now } from "./db";
import { fromRel, mediaDir, newId, toRel, mediaUrl } from "./paths";
import { getRender } from "./render";
import { requireProject, NotFoundError, ValidationError } from "./repo";

interface ExportRow {
  id: string;
  project_id: string;
  render_id: string;
  title: string;
  path: string;
  srt_path: string | null;
  vtt_path: string | null;
  is_demo: number;
  size_bytes: number | null;
  duration_sec: number | null;
  created_at: number;
}

const view = (r: ExportRow & { project_title?: string }) => ({
  id: r.id,
  projectId: r.project_id,
  projectTitle: r.project_title ?? null,
  renderId: r.render_id,
  title: r.title,
  url: mediaUrl(r.path),
  downloadUrl: `${mediaUrl(r.path)}?download=1`,
  srtUrl: r.srt_path ? `${mediaUrl(r.srt_path)}?download=1` : null,
  vttUrl: r.vtt_path ? `${mediaUrl(r.vtt_path)}?download=1` : null,
  isDemo: !!r.is_demo,
  sizeBytes: r.size_bytes,
  durationSec: r.duration_sec,
  createdAt: r.created_at,
});

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "short";
}

/** Export = your final approval. Only an approved, finished FINAL render can be exported. */
export function createExport(projectId: string, renderId: string) {
  const p = requireProject(projectId);
  const r = getRender(renderId);
  if (!r || r.projectId !== projectId) throw new NotFoundError("Render not found");
  if (r.status !== "done") throw new ValidationError("This render hasn't finished.");
  if (r.quality !== "final") throw new ValidationError("Previews can't be exported. Render the final 1080×1920 version first.");
  if (r.approval !== "approved") throw new ValidationError("Approve the final render before exporting it.");
  const existing = db().prepare("SELECT * FROM exports WHERE render_id = ?").get(renderId) as ExportRow | undefined;
  if (existing) return view(existing);
  const row = db().prepare("SELECT path, captions_path, options_json FROM renders WHERE id = ?").get(renderId) as { path: string; captions_path: string | null; options_json: string };
  const dir = mediaDir("exports");
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${slug(p.title)}-${stamp}-${renderId.slice(-6)}${r.isDemo ? "-DEMO" : ""}`;
  const mp4 = path.join(dir, `${base}.mp4`);
  fs.copyFileSync(fromRel(row.path), mp4);
  const opts = JSON.parse(row.options_json || "{}") as { srt?: string; vtt?: string };
  let srt: string | null = null;
  let vtt: string | null = null;
  if (opts.srt) fs.copyFileSync(fromRel(opts.srt), (srt = path.join(dir, `${base}.srt`)));
  if (opts.vtt) fs.copyFileSync(fromRel(opts.vtt), (vtt = path.join(dir, `${base}.vtt`)));
  const id = newId("e_");
  db()
    .prepare("INSERT INTO exports(id,project_id,render_id,title,path,srt_path,vtt_path,is_demo,size_bytes,duration_sec,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, projectId, renderId, p.title, toRel(mp4), srt ? toRel(srt) : null, vtt ? toRel(vtt) : null, r.isDemo ? 1 : 0, fs.statSync(mp4).size, r.durationSec, now());
  db().prepare("UPDATE projects SET status = 'exported', updated_at = ? WHERE id = ?").run(now(), projectId);
  return view(db().prepare("SELECT * FROM exports WHERE id = ?").get(id) as ExportRow);
}

export function listExports(f: { projectId?: string; q?: string } = {}) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.projectId) (where.push("e.project_id = ?"), args.push(f.projectId));
  if (f.q) (where.push("(e.title LIKE ? OR p.title LIKE ?)"), args.push(`%${f.q}%`, `%${f.q}%`));
  const rows = db()
    .prepare(`SELECT e.*, p.title AS project_title FROM exports e LEFT JOIN projects p ON p.id = e.project_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY e.created_at DESC LIMIT 300`)
    .all(...args) as (ExportRow & { project_title: string })[];
  return rows.map(view);
}

export function deleteExport(id: string) {
  const r = db().prepare("SELECT * FROM exports WHERE id = ?").get(id) as ExportRow | undefined;
  if (!r) throw new NotFoundError("Export not found");
  for (const p of [r.path, r.srt_path, r.vtt_path]) if (p) fs.rmSync(fromRel(p), { force: true });
  db().prepare("DELETE FROM exports WHERE id = ?").run(id);
}
