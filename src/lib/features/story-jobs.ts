import "server-only";
import { db, now } from "../db";
import { newId } from "../paths";
import { registerHandler } from "../jobs";
import { generateProjectStory } from "../story";
import { requireProject } from "../repo";

export function registerStoryHandlers() {
  registerHandler("story.generate", async (ctx) => {
    const { projectId, variation, generationId } = ctx.job.payload as { projectId: string; variation: number; generationId?: string };
    ctx.progress(0.1, "Writing story…");
    try {
      const r = await generateProjectStory(projectId, variation ?? 0);
      if (generationId) db().prepare("UPDATE generations SET status='completed', completed_at=?, updated_at=? WHERE id=?").run(now(), now(), generationId);
      ctx.progress(1, r.warning ?? `Story ready (${r.scenes} scenes, ${r.provider})`);
      return r;
    } catch (e) {
      if (generationId) db().prepare("UPDATE generations SET status='failed', error=?, updated_at=? WHERE id=?").run(String((e as Error).message), now(), generationId);
      throw e;
    }
  });
}

/** Record a paid LLM story call so it counts toward budgets. */
export function recordPaidStory(projectId: string, provider: string, model: string, estimate: number) {
  requireProject(projectId);
  const id = newId("g_");
  db()
    .prepare(
      `INSERT INTO generations(id,project_id,kind,provider,model,prompt,params_json,status,idempotency_key,estimated_cost,is_paid,approved_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
    )
    .run(id, projectId, "story", provider, model, "story", "{}", "generating", id, estimate, now(), now(), now());
  return id;
}
