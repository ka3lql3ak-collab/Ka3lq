import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { freshDataDir } from "./helpers";

freshDataDir("sec");
const { fromRel, toRel, mediaRoot, mediaDir } = await import("@/lib/paths");
const { redact } = await import("@/lib/log");
const { signPath, verifyPath, publicImageUrl } = await import("@/lib/public-url");
const { GET: mediaGET } = await import("@/app/api/media/[...path]/route");
const { escapeFilterPath, speakable } = await import("@/lib/media/tts");
const { saveUpload } = await import("@/lib/uploads");

describe("file handling", () => {
  it("refuses paths that escape the media root", () => {
    expect(() => fromRel("../../etc/passwd")).toThrow(/escapes/);
    expect(() => fromRel("/etc/passwd")).toThrow();
    expect(() => toRel("/etc/passwd")).toThrow(/escapes/);
    expect(() => mediaDir("..", "x")).toThrow(/Unsafe/);
    expect(fromRel("projects/x/a.png")).toBe(path.join(mediaRoot(), "projects/x/a.png"));
  });

  it("media route blocks traversal and unknown file types, supports ranges", async () => {
    const ctx = (segs: string[]) => ({ params: Promise.resolve({ path: segs }) });
    expect((await mediaGET(new Request("http://x/api/media"), ctx(["..", "..", "etc", "passwd"]))).status).toBe(400);
    const dir = mediaDir("t");
    fs.writeFileSync(path.join(dir, "secret.env"), "x");
    expect((await mediaGET(new Request("http://x"), ctx(["t", "secret.env"]))).status).toBe(415);
    fs.writeFileSync(path.join(dir, "a.mp4"), Buffer.alloc(1000, 1));
    const r = await mediaGET(new Request("http://x", { headers: { range: "bytes=10-19" } }), ctx(["t", "a.mp4"]));
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 10-19/1000");
    expect((await r.arrayBuffer()).byteLength).toBe(10);
  });

  it("validates uploads by extension, size and content", async () => {
    const dir = mediaDir("up");
    await expect(saveUpload(new File(["hi"], "x.exe"), "video", dir)).rejects.toThrow(/Unsupported/);
    await expect(saveUpload(new File(["not a video"], "x.mp4"), "video", dir)).rejects.toThrow(/could not be read|no video/);
    expect(fs.readdirSync(dir)).toHaveLength(0); // rejected files are removed
  });
});

describe("secrets", () => {
  it("redacts configured keys and bearer tokens from any message", () => {
    process.env.HF_KEY = "keyid_abcdef:supersecretvalue";
    process.env.LUMA_API_KEY = "luma-secret-123456";
    const s = redact("failed with keyid_abcdef:supersecretvalue and luma-secret-123456 Authorization: Bearer abc.def.ghi");
    expect(s).not.toMatch(/supersecretvalue|luma-secret-123456|abc\.def\.ghi/);
    delete process.env.HF_KEY;
    delete process.env.LUMA_API_KEY;
  });

  it("no client component references server secrets or server-only modules", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(path.resolve("src"));
    const clientFiles = files.filter((f) => fs.readFileSync(f, "utf8").startsWith('"use client"'));
    expect(clientFiles.length).toBeGreaterThan(10);
    for (const f of clientFiles) {
      const src = fs.readFileSync(f, "utf8");
      // Mentioning a variable's NAME in setup instructions is fine; reading env or importing server modules is not.
      expect(src, f).not.toMatch(/process\.env|@\/lib\/(config|db|settings|generations|render|repo|exports|costs|jobs|providers)|better-sqlite3|server-only/);
    }
  });
});

describe("signed public URLs and webhooks", () => {
  it("signatures verify only for the exact path", () => {
    const sig = signPath("projects/p/a.png");
    expect(verifyPath("projects/p/a.png", sig)).toBe(true);
    expect(verifyPath("projects/p/b.png", sig)).toBe(false);
    expect(verifyPath("projects/p/a.png", "x".repeat(32))).toBe(false);
  });
  it("public URLs are only produced when PUBLIC_BASE_URL is set", () => {
    delete process.env.PUBLIC_BASE_URL;
    expect(publicImageUrl("projects/p/a.png")).toBeNull();
    process.env.PUBLIC_BASE_URL = "https://studio.example.com/";
    expect(publicImageUrl("projects/p/a.png")).toMatch(/^https:\/\/studio\.example\.com\/api\/public\/[\w-]{32}\/projects\/p\/a\.png$/);
    delete process.env.PUBLIC_BASE_URL;
  });
});

describe("text handed to FFmpeg", () => {
  it("escapes filter paths and cleans speech text", () => {
    expect(escapeFilterPath("/a:b,c'd[e]")).toBe("/a\\:b\\,c\\'d\\[e\\]");
    expect(speakable("Hi 🍓 *there* & you — ok…")).toBe("Hi there and you , ok...");
  });
});
