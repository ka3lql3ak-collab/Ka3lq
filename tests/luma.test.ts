import { describe, it, expect, beforeAll } from "vitest";
import { freshDataDir } from "./helpers";

freshDataDir("luma");
process.env.LUMA_API_KEY = "luma_test_key_123456";
const repo = await import("@/lib/repo");
const { setLumaFetch } = await import("@/lib/providers/luma");
const gens = await import("@/lib/generations");
const jobs = await import("@/lib/jobs");
const visuals = await import("@/lib/features/visuals");
const { saveSettings } = await import("@/lib/settings");
const { generateProjectStory } = await import("@/lib/story");
const { StorySettingsSchema } = await import("@/lib/types");
gens.registerGenerationHandlers();

const calls: { method: string; url: string; body: unknown }[] = [];
let balance = 1000; // cents
setLumaFetch(async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (url.endsWith("/credits")) return Response.json({ credit_balance: balance });
  if (method === "POST" && url.endsWith("/generations/video")) {
    balance -= 35;
    return Response.json({ id: "11111111-2222-3333-4444-555555555555", state: "queued" });
  }
  if (url.includes("/generations/11111111")) return Response.json({ id: "11111111-2222-3333-4444-555555555555", state: "failed", failure_reason: "Prompt rejected" });
  return new Response("nope", { status: 404 });
});

describe("Luma (optional secondary provider)", () => {
  let projectId = "";
  let sceneId = "";
  beforeAll(async () => {
    saveSettings({ video: { provider: "luma", model: "ray-flash-2", resolution: "720p", duration: "auto" } });
    const p = repo.createProject(StorySettingsSchema.parse({ idea: "A grumpy lemon learns to smile at the market", sceneCount: 3, durationSec: 15 }));
    projectId = p.id;
    await generateProjectStory(p.id, 0);
    sceneId = repo.listScenes(p.id)[0].id;
  });

  it("is used only when selected, sends the documented body, and records actual cost from the balance", async () => {
    const plan = visuals.planClip(projectId, sceneId);
    expect(plan).toMatchObject({ providerId: "luma-video", mode: "text-to-video", estimate: 0.35 });
    const { generation } = visuals.requestClip(projectId, sceneId, { requestId: "luma-test-0001", confirmCost: true, estimate: 0.35 });
    await jobs.drainJobs();
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ model: "ray-flash-2", aspect_ratio: "9:16", resolution: "720p", loop: false });
    await gens._test.pollOne(generation.id);
    const g = gens.getGeneration(generation.id)!;
    expect(g.status).toBe("failed");
    expect(g.error).toBe("Prompt rejected");
    expect(g.actualCost).toBe(0.35); // measured from /credits delta
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });
});
