import { describe, it, expect, beforeAll } from "vitest";
import { freshDataDir } from "./helpers";

freshDataDir("persist");
const repo = await import("@/lib/repo");
const { closeDb } = await import("@/lib/db");
const jobs = await import("@/lib/jobs");
const { StorySettingsSchema } = await import("@/lib/types");

const settings = StorySettingsSchema.parse({ idea: "A lonely strawberry finds a tiny abandoned orange and decides to help it." });

describe("project persistence", () => {
  let id = "";
  beforeAll(() => {
    id = repo.createProject(settings).id;
  });

  it("creates a project with a derived title and validated settings", () => {
    const p = repo.getProject(id)!;
    expect(p.title).toMatch(/^A lonely strawberry/);
    expect(p.settings.durationSec).toBe(30);
    expect(p.settings.genre).toBe("wholesome");
  });

  it("survives a database reconnect (persistent history)", () => {
    repo.updateProject(id, { title: "Berry & Pip" });
    closeDb();
    expect(repo.getProject(id)?.title).toBe("Berry & Pip");
  });

  it("searches and archives", () => {
    repo.createProject(StorySettingsSchema.parse({ idea: "A grumpy lemon learns to smile at the market" }));
    expect(repo.listProjects({ q: "lemon" })).toHaveLength(1);
    repo.updateProject(id, { archived: true });
    expect(repo.listProjects({}).some((p) => p.id === id)).toBe(false);
    expect(repo.listProjects({ archived: true }).some((p) => p.id === id)).toBe(true);
  });

  it("rejects invalid settings", () => {
    expect(() => StorySettingsSchema.parse({ idea: "hi" })).toThrow();
    expect(() => StorySettingsSchema.parse({ idea: "A valid idea here", durationSec: 20 })).toThrow();
  });

  it("deletes a project and cascades scenes", () => {
    const p = repo.createProject(settings);
    repo.replaceScenes(p.id, [
      { beat: "hook", durationSec: 3, visual: "A strawberry", camera: "", characters: [], action: "", emotion: "", dialogue: [], narration: "", sfx: [], caption: "" },
      { beat: "payoff", durationSec: 4, visual: "A hug", camera: "", characters: [], action: "", emotion: "", dialogue: [], narration: "", sfx: [], caption: "" },
    ]);
    expect(repo.listScenes(p.id)).toHaveLength(2);
    repo.deleteProject(p.id);
    expect(repo.getProject(p.id)).toBeNull();
    expect(repo.listScenes(p.id)).toHaveLength(0);
  });

  it("reorders scenes and refuses incomplete orderings", () => {
    const p = repo.createProject(settings);
    const mk = (v: string) => ({ beat: "setup" as const, durationSec: 3, visual: v, camera: "", characters: [], action: "", emotion: "", dialogue: [], narration: "", sfx: [], caption: "" });
    repo.replaceScenes(p.id, [mk("a"), mk("b"), mk("c")]);
    const ids = repo.listScenes(p.id).map((s) => s.id);
    repo.reorderScenes(p.id, [ids[2], ids[0], ids[1]]);
    expect(repo.listScenes(p.id).map((s) => s.visual)).toEqual(["c", "a", "b"]);
    expect(() => repo.reorderScenes(p.id, [ids[0]])).toThrow(/every scene/);
  });
});

describe("job queue", () => {
  it("runs handlers, records results and failures without leaking secrets", async () => {
    process.env.LUMA_API_KEY = "sk-super-secret-key-123";
    jobs.registerHandler("test.ok", async (ctx) => {
      ctx.progress(0.5, "halfway");
      return { value: 42 };
    });
    jobs.registerHandler("test.fail", async () => {
      throw new Error("provider said: bad key sk-super-secret-key-123");
    });
    const a = jobs.enqueue("test.ok", {});
    const b = jobs.enqueue("test.fail", {});
    await jobs.drainJobs();
    expect(jobs.getJob(a.id)).toMatchObject({ status: "done", result: { value: 42 }, progress: 1 });
    const fb = jobs.getJob(b.id)!;
    expect(fb.status).toBe("failed");
    expect(fb.error).not.toContain("sk-super-secret-key-123");
    expect(fb.error).toContain("[REDACTED]");
    delete process.env.LUMA_API_KEY;
  });

  it("dedupes identical queued jobs and supports cancellation", async () => {
    const a = jobs.enqueue("test.ok", {}, null, { dedupeKey: "same" });
    const b = jobs.enqueue("test.ok", {}, null, { dedupeKey: "same" });
    expect(b.id).toBe(a.id);
    expect(jobs.cancelJob(a.id)).toBe(true);
    await jobs.drainJobs();
    expect(jobs.getJob(a.id)?.status).toBe("cancelled");
  });
});
