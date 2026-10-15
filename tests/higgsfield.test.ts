import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { freshDataDir } from "./helpers";

freshDataDir("hf");
process.env.HF_KEY = "kid_123456:ksecret_abcdefgh";
const repo = await import("@/lib/repo");
const { setHiggsfieldFetch } = await import("@/lib/providers/higgsfield");
const gens = await import("@/lib/generations");
const jobs = await import("@/lib/jobs");
const visuals = await import("@/lib/features/visuals");
const { saveSettings } = await import("@/lib/settings");
const { committedSpend } = await import("@/lib/costs");
const { generateProjectStory } = await import("@/lib/story");
const { StorySettingsSchema } = await import("@/lib/types");
gens.registerGenerationHandlers();

/* ---------------------- fake Higgsfield Cloud (per SDK contract) --------------------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hf-assets-"));
const MP4 = path.join(tmp, "clip.mp4");
const PNG = path.join(tmp, "frame.png");
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=576x1024:d=5:r=24", "-c:v", "libx264", "-pix_fmt", "yuv420p", MP4]);
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=pink:s=576x1024", "-frames:v", "1", PNG]);

interface Call {
  method: string;
  url: string;
  auth: string | null;
  body: unknown;
}
let calls: Call[] = [];
let statuses: string[] = [];
let submitMode: "ok" | "timeout" | "401" | "429" | "500" = "ok";
let downloadCorrupt = false;

const fake: typeof fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const auth = new Headers(init?.headers).get("authorization");
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ? "<bytes>" : undefined;
  calls.push({ method, url, auth, body });
  if (url === "https://upload.hf.test/slot") return new Response(null, { status: 200 });
  if (url.startsWith("https://cdn.hf.test/")) {
    if (url.endsWith(".mp4")) return new Response(downloadCorrupt ? "not a video" : fs.readFileSync(MP4), { headers: { "content-type": "video/mp4" } });
    return new Response(fs.readFileSync(PNG), { headers: { "content-type": "image/png" } });
  }
  if (url === "https://api.higgsfield.ai/files/generate-upload-url") return Response.json({ public_url: "https://cdn.hf.test/uploaded.png", upload_url: "https://upload.hf.test/slot" });
  if (method === "POST" && (url.includes("/v1/image2video/dop") || url.includes("/v1/text2image/soul"))) {
    if (submitMode === "timeout") throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (submitMode === "401") return new Response(JSON.stringify({ detail: "Invalid credentials ksecret_abcdefgh" }), { status: 401 });
    if (submitMode === "429") return new Response(JSON.stringify({ detail: "Too many requests" }), { status: 429 });
    if (submitMode === "500") return new Response("upstream error", { status: 502 });
    const id = `req-${calls.length.toString().padStart(8, "0")}`;
    return Response.json({ request_id: id, status: "queued", status_url: `https://api.higgsfield.ai/requests/${id}/status`, cancel_url: `https://api.higgsfield.ai/requests/${id}/cancel` });
  }
  const st = /\/requests\/([^/]+)\/status$/.exec(url);
  if (st) {
    const s = statuses.shift() ?? "in_progress";
    const isVideo = calls.some((c) => c.url.includes("image2video"));
    return Response.json({ request_id: st[1], status: s, ...(s === "completed" ? (isVideo && !url.includes("soul") ? { video: { url: "https://cdn.hf.test/out.mp4" } } : {}) : {}), ...(s === "completed" ? { images: [{ url: "https://cdn.hf.test/out.png" }] } : {}) });
  }
  if (/\/requests\/[^/]+\/cancel$/.test(url)) return new Response(JSON.stringify({ detail: "Request is already in progress" }), { status: 400 });
  return new Response("not found", { status: 404 });
};
setHiggsfieldFetch(fake);

/* ------------------------------------ setup ----------------------------------------- */
let projectId = "";
let sceneIds: string[] = [];
beforeAll(async () => {
  saveSettings({ budget: { perSceneUsd: 2, perProjectUsd: 3, monthlyUsd: 50 }, video: { provider: "higgsfield", higgsfieldModel: "dop-turbo" }, image: { provider: "higgsfield", higgsfieldQuality: "1080p" } });
  const p = repo.createProject(StorySettingsSchema.parse({ idea: "A lonely strawberry finds a tiny abandoned orange and decides to help it.", sceneCount: 4 }));
  projectId = p.id;
  await generateProjectStory(p.id, 0);
  sceneIds = repo.listScenes(p.id).map((s) => s.id);
});
beforeEach(() => {
  calls = [];
  statuses = [];
  submitMode = "ok";
  downloadCorrupt = false;
});

const rid = () => `test-${Math.random().toString(36).slice(2, 12)}`;
async function runSubmit() {
  await jobs.drainJobs();
}

describe("Higgsfield: character reference and keyframes", () => {
  it("requires explicit cost confirmation before a paid Soul image", () => {
    const c = repo.projectCharacters(projectId)[0];
    try {
      visuals.requestReference(c.id, { requestId: rid() });
      expect.unreachable();
    } catch (e) {
      expect((e as { status: number }).status).toBe(402);
      expect((e as { details: { estimate: number } }).details.estimate).toBe(0.1);
    }
    expect(calls).toHaveLength(0); // nothing sent
  });

  it("generates a reference portrait, saves it locally, and lets the user approve it", async () => {
    const c = repo.projectCharacters(projectId)[0];
    const { generation } = visuals.requestReference(c.id, { requestId: rid(), confirmCost: true, estimate: 0.1 });
    await runSubmit();
    const submit = calls.find((x) => x.url.endsWith("/v1/text2image/soul"))!;
    expect(submit.auth).toBe("Key kid_123456:ksecret_abcdefgh");
    expect(submit.body).toMatchObject({ width_and_height: "1536x1536", quality: "1080p", batch_size: 1 });
    statuses = ["queued", "in_progress", "completed"];
    for (let i = 0; i < 3; i++) await gens._test.pollOne(generation.id);
    const g = gens.getGeneration(generation.id)!;
    expect(g.status).toBe("completed");
    const asset = repo.getAsset(gens._test.row(generation.id)!.asset_id!)!;
    expect(asset.kind).toBe("reference");
    expect(asset.remoteUrl).toBe("https://cdn.hf.test/out.png");
    repo.setCharacterApprovedImage(c.id, asset.id);
    expect(repo.getCharacter(c.id)!.approvedImageId).toBe(asset.id);
  });

  it("builds a 9:16 scene keyframe that reuses the approved character reference", async () => {
    const { generation } = visuals.requestStoryboard(projectId, sceneIds[0], { providerId: "higgsfield-image", requestId: rid(), confirmCost: true, estimate: 0.1 });
    await runSubmit();
    const submit = calls.find((x) => x.url.endsWith("/v1/text2image/soul"))!;
    expect(submit.body).toMatchObject({ width_and_height: "1152x2048", image_reference: { type: "image_url", image_url: "https://cdn.hf.test/out.png" } });
    expect(String((submit.body as { prompt: string }).prompt)).toMatch(/No text/);
    statuses = ["completed"];
    await gens._test.pollOne(generation.id);
    expect(repo.getScene(sceneIds[0])!.storyboardAssetId).toBeTruthy();
  });
});

describe("Higgsfield: DoP clips", () => {
  it("blocks DoP when the scene only has a sketch (sketches are never keyframes)", async () => {
    await visuals.sketchAllStoryboards(projectId);
    await jobs.drainJobs();
    const plan = visuals.planClip(projectId, sceneIds[1]);
    expect(plan.mode).toBe("blocked");
    expect(() => visuals.requestClip(projectId, sceneIds[1], { requestId: rid(), confirmCost: true, estimate: plan.estimate })).toThrow(/keyframe/);
  });

  it("submits once, tracks status, downloads, validates and attaches the clip", async () => {
    const plan = visuals.planClip(projectId, sceneIds[0]);
    expect(plan).toMatchObject({ providerId: "higgsfield-video", mode: "image-to-video", estimate: 0.5, preferred: "higgsfield", preferredConfigured: true });
    const id = rid();
    const { generation } = visuals.requestClip(projectId, sceneIds[0], { requestId: id, confirmCost: true, estimate: 0.5 });
    // Same requestId (double click / client retry after timeout) → same generation, no new job.
    const again = visuals.requestClip(projectId, sceneIds[0], { requestId: id, confirmCost: true, estimate: 0.5 });
    expect(again.generation.id).toBe(generation.id);
    expect(again.reused).toBe(true);
    await runSubmit();
    const posts = calls.filter((c) => c.method === "POST" && c.url.includes("/v1/image2video/dop"));
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ model: "dop-turbo", input_images: [{ type: "image_url", image_url: "https://cdn.hf.test/out.png" }] });
    expect(gens.getGeneration(generation.id)!.status).toBe("submitted");
    // A second paid job for the same scene while one is in flight is refused.
    expect(() => visuals.requestClip(projectId, sceneIds[0], { requestId: rid(), confirmCost: true, estimate: 0.5 })).toThrow(/already in progress/);
    statuses = ["queued", "in_progress", "completed"];
    for (let i = 0; i < 3; i++) await gens._test.pollOne(generation.id);
    const g = gens.getGeneration(generation.id)!;
    expect(g.status).toBe("completed");
    const scene = repo.getScene(sceneIds[0])!;
    const clip = repo.getAsset(scene.clipAssetId!)!;
    expect(clip.provider).toBe("higgsfield-video");
    expect(clip.isDemo).toBe(false);
    expect(clip.meta.durationSec).toBeCloseTo(5, 0);
    expect(scene.approval).toBe("pending"); // new takes need approval
    expect(calls.filter((c) => c.method === "POST" && c.url.includes("/v1/image2video/dop"))).toHaveLength(1); // polling never resubmits
  });

  it("uploads a local keyframe to Higgsfield's CDN when there is no remote URL", async () => {
    const form = repo.createAsset({ projectId, sceneId: sceneIds[2], kind: "storyboard", path: "x", provider: "upload" });
    // simulate an uploaded keyframe on disk
    const { mediaDir, toRel } = await import("@/lib/paths");
    const dest = path.join(mediaDir("projects", projectId, "storyboards"), "mine.png");
    fs.copyFileSync(PNG, dest);
    repo.deleteAsset(form.id);
    const up = repo.createAsset({ projectId, sceneId: sceneIds[2], kind: "storyboard", path: toRel(dest), provider: "upload" });
    repo.setSceneFields(sceneIds[2], { storyboardAssetId: up.id });
    visuals.requestClip(projectId, sceneIds[2], { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    expect(calls.map((c) => c.url)).toContain("https://api.higgsfield.ai/files/generate-upload-url");
    expect(calls.find((c) => c.url === "https://upload.hf.test/slot")?.auth ?? null).toBeNull(); // credentials never sent to storage
    const dop = calls.find((c) => c.url.includes("/v1/image2video/dop"))!;
    expect(dop.body).toMatchObject({ input_images: [{ image_url: "https://cdn.hf.test/uploaded.png" }] });
  });
});

describe("Higgsfield: failures never cause duplicate charges", () => {
  async function newScene() {
    const sc = repo.addScene(projectId, { beat: "setup", durationSec: 4, visual: "Berry waves", camera: "", characters: [], action: "", emotion: "", dialogue: [], narration: "", sfx: [], caption: "" });
    const a = repo.createAsset({ projectId, sceneId: sc.id, kind: "storyboard", path: "unused.png", remoteUrl: "https://cdn.hf.test/k.png", provider: "higgsfield-image" });
    repo.setSceneFields(sc.id, { storyboardAssetId: a.id });
    return sc.id;
  }

  it("a timed-out submission becomes 'unknown' and is never resubmitted", async () => {
    saveSettings({ budget: { perProjectUsd: 100 } });
    const sid = await newScene();
    submitMode = "timeout";
    const { generation } = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    const g = gens.getGeneration(generation.id)!;
    expect(g.status).toBe("unknown");
    expect(g.error).toMatch(/NOT be resubmitted/);
    await gens.pollGenerations();
    await jobs.drainJobs();
    expect(calls.filter((c) => c.url.includes("/v1/image2video/dop"))).toHaveLength(1);
    // Unknown outcomes count toward spend (conservative) until dismissed.
    const before = committedSpend({ projectId });
    await gens.cancelGeneration(generation.id);
    expect(gens.getGeneration(generation.id)!.status).toBe("failed");
    expect(committedSpend({ projectId })).toBeCloseTo(before - 0.5);
  });

  it("a 5xx answer to a submission is also treated as unknown (not retried)", async () => {
    const sid = await newScene();
    submitMode = "500";
    const { generation } = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    expect(gens.getGeneration(generation.id)!.status).toBe("unknown");
    expect(calls.filter((c) => c.url.includes("/v1/image2video/dop"))).toHaveLength(1);
  });

  it("401 fails clearly without leaking the secret; 429 fails as 'nothing submitted'", async () => {
    const sid = await newScene();
    submitMode = "401";
    const a = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    const g = gens.getGeneration(a.generation.id)!;
    expect(g.status).toBe("failed");
    expect(g.error).toMatch(/HF_KEY/);
    expect(g.error).not.toContain("ksecret_abcdefgh");
    expect(committedSpend({ sceneId: sid })).toBe(0); // rejected → not counted
    submitMode = "429";
    const b = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    expect(gens.getGeneration(b.generation.id)!.error).toMatch(/rate limited.*nothing was submitted/);
  });

  it("moderation (nsfw) and failed results are reported, with no automatic retry", async () => {
    const sid = await newScene();
    const { generation } = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    statuses = ["nsfw"];
    await gens._test.pollOne(generation.id);
    const g = gens.getGeneration(generation.id)!;
    expect(g.status).toBe("failed");
    expect(g.error).toMatch(/moderation/);
    expect(calls.filter((c) => c.url.includes("/v1/image2video/dop"))).toHaveLength(1);
  });

  it("a corrupt download is reported instead of producing a fake clip", async () => {
    const sid = await newScene();
    const { generation } = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    statuses = ["completed"];
    downloadCorrupt = true;
    await gens._test.pollOne(generation.id);
    const g = gens.getGeneration(generation.id)!;
    expect(g.status).toBe("failed");
    expect(g.error).toMatch(/unreadable|could not be saved/);
    expect(repo.getScene(sid)!.clipAssetId).toBeNull();
  });

  it("cancelling an in-progress request explains that Higgsfield will still finish it", async () => {
    const sid = await newScene();
    const { generation } = visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
    await runSubmit();
    const g = await gens.cancelGeneration(generation.id);
    expect(g.status).toBe("cancelled");
    expect(g.error).toMatch(/only cancels queued requests/);
  });
});

describe("budget limits", () => {
  it("blocks paid requests that would exceed the project budget, before anything is sent", () => {
    saveSettings({ budget: { perProjectUsd: 0.4 } });
    const sid = sceneIds[3];
    const a = repo.createAsset({ projectId, sceneId: sid, kind: "storyboard", path: "u.png", remoteUrl: "https://cdn.hf.test/k.png", provider: "higgsfield-image" });
    repo.setSceneFields(sid, { storyboardAssetId: a.id });
    try {
      visuals.requestClip(projectId, sid, { requestId: rid(), confirmCost: true, estimate: 0.5 });
      expect.unreachable();
    } catch (e) {
      expect((e as { status: number }).status).toBe(402);
      expect((e as Error).message).toMatch(/Project budget/);
      expect((e as { details: { blocked: boolean } }).details.blocked).toBe(true);
    }
    expect(calls).toHaveLength(0);
  });

  it("a stale estimate (prices changed) is refused", () => {
    saveSettings({ budget: { perProjectUsd: 100 } });
    expect(() => visuals.requestClip(projectId, sceneIds[3], { requestId: rid(), confirmCost: true, estimate: 0.01 })).toThrow(/confirmation/);
  });
});

describe("no silent provider switching", () => {
  it("without Higgsfield credentials, falls back to a labelled free demo — never to Luma", () => {
    const key = process.env.HF_KEY;
    delete process.env.HF_KEY;
    process.env.LUMA_API_KEY = "luma-key-present";
    try {
      const plan = visuals.planClip(projectId, sceneIds[0]);
      expect(plan.providerId).toBe("demo-video");
      expect(plan.preferred).toBe("higgsfield");
      expect(plan.preferredConfigured).toBe(false);
      expect(plan.note).toMatch(/Higgsfield API isn't configured/);
      expect(plan.note).toMatch(/NOT AI video/);
    } finally {
      process.env.HF_KEY = key;
      delete process.env.LUMA_API_KEY;
    }
  });
});
