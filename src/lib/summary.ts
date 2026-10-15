import "server-only";
import { db } from "./db";
import { mediaUrl } from "./paths";
import { committedSpend } from "./costs";
import type { Project } from "./repo";

export interface ProjectSummary {
  id: string;
  title: string;
  idea: string;
  status: string;
  genre: string;
  durationSec: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  sceneCount: number;
  approvedScenes: number;
  clipCount: number;
  storyboardCount: number;
  exportCount: number;
  hasStory: boolean;
  scriptApproved: boolean;
  coverUrl: string | null;
  spent: number;
  stage: string;
}

export function summarize(p: Project): ProjectSummary {
  const c = db()
    .prepare(
      `SELECT COUNT(*) AS scenes,
              SUM(approval='approved') AS approved,
              SUM(clip_asset_id IS NOT NULL) AS clips,
              SUM(storyboard_asset_id IS NOT NULL) AS boards
       FROM scenes WHERE project_id = ?`,
    )
    .get(p.id) as { scenes: number; approved: number | null; clips: number | null; boards: number | null };
  const cover = db()
    .prepare(`SELECT a.path FROM scenes s JOIN assets a ON a.id = s.storyboard_asset_id WHERE s.project_id = ? ORDER BY s.idx LIMIT 1`)
    .get(p.id) as { path: string } | undefined;
  const exports = (db().prepare("SELECT COUNT(*) AS n FROM exports WHERE project_id = ?").get(p.id) as { n: number }).n;
  const stage = !p.story
    ? "Idea"
    : !p.scriptApproved
      ? "Script"
      : (c.boards ?? 0) < c.scenes
        ? "Storyboard"
        : (c.clips ?? 0) < c.scenes
          ? "Animating"
          : exports === 0
            ? "Editing"
            : "Exported";
  return {
    id: p.id,
    title: p.title,
    idea: p.idea,
    status: p.status,
    genre: p.settings.genre,
    durationSec: p.settings.durationSec,
    archived: p.archived,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    sceneCount: c.scenes,
    approvedScenes: c.approved ?? 0,
    clipCount: c.clips ?? 0,
    storyboardCount: c.boards ?? 0,
    exportCount: exports,
    hasStory: !!p.story,
    scriptApproved: p.scriptApproved,
    coverUrl: cover ? mediaUrl(cover.path) : null,
    spent: committedSpend({ projectId: p.id }),
    stage,
  };
}
