# 🍓 Fruit Shorts Studio

Turn a one-line idea into an edited, vertical YouTube Short starring cute 3D fruit characters, while you approve every step and every cent.

```
IDEA → STORY → CHARACTERS → STORYBOARD → AI VIDEO CLIPS → VOICEOVER → SFX → CAPTIONS → EDIT → YOUR APPROVAL → MP4
 free    free      free        free          PAID ($)        free       free    free     free     you          free
```

Everything except AI video and image generation runs locally for **$0**. Higgsfield is the preferred video provider. Without API keys the app runs in a clearly labelled **demo mode**.

---

## Quick start

Requirements: **Node.js 20+** and **FFmpeg** built with `libass`, `libx264` and `libflite`. Stock Ubuntu/Debian `ffmpeg` packages include all three. On macOS, `brew install ffmpeg` lacks flite, so install Piper for voices (see below).

```bash
npm install
cp .env.example .env.local      # optional: everything works without keys (demo mode)
npm run dev                     # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

Checks:

```bash
npm run lint     # TypeScript type check
npm test         # 59 tests, including real FFmpeg renders (≈1 min)
```

Data (SQLite database, clips, audio, renders, exports) lives in `~/.fruit-shorts-studio` by default. Override it with `DATA_DIR`, but keep it **outside** the project folder, or the dev server reloads on every write.

---

## Higgsfield (preferred video provider)

### What was verified, and how

`docs.higgsfield.ai` and `higgsfield.ai` couldn't be reached from the build environment. The integration was therefore written against Higgsfield's **official SDKs**: [`@higgsfield/client`](https://www.npmjs.com/package/@higgsfield/client) 0.2.6 (Node) and [`higgsfield-client`](https://pypi.org/project/higgsfield-client/) 0.2.0 (Python). Their source defines the API contract:

| | |
|---|---|
| Auth | `Authorization: Key KEY_ID:KEY_SECRET` |
| Base URL | `https://api.higgsfield.ai` |
| Submit | `POST /{application}` → `{ request_id, status, status_url, cancel_url }`; optional `?hf_webhook=URL` |
| Status | `GET /requests/{id}/status` → `queued · in_progress · completed · failed · nsfw · canceled`, with `video.url` / `images[].url` |
| Cancel | `POST /requests/{id}/cancel` (queued requests only) |
| Upload | `POST /files/generate-upload-url` → `{ public_url, upload_url }`, then `PUT` the bytes |
| Refunds | `failed` and `nsfw` results are refunded (per SDK docs) |

The app uses the two generation applications documented in the SDKs:

- **Soul** `/v1/text2image/soul`: character reference portraits (1536×1536) and **9:16 scene keyframes** (1152×2048). Each keyframe passes your approved character image as `image_reference`.
- **DoP** `/v1/image2video/dop` (`dop-lite` / `dop-turbo` / `dop-standard`): animates each keyframe with the scene's motion and camera prompt.

DoP has **no documented aspect-ratio or duration parameter**. The clip follows the keyframe's 9:16 framing, and the editor trims the clip or holds its last frame to fit each scene's length.

Other models shown in the Higgsfield app (Kling, Seedance, Minimax…) are **not wired in**, because their Cloud API paths couldn't be verified. Use the manual-import workflow for those.

**Duplicate-charge protection:** the official SDK's `subscribe()` retries the billable POST on timeouts and 5xx errors, which can create and bill a second generation. This app sends every billable POST **exactly once**. A timeout or 5xx becomes an `unknown` state that is never resubmitted. Higgsfield documents no lookup-by-prompt endpoint, so you check your dashboard and then dismiss or retry manually.

### What your account needs

1. A **Higgsfield Cloud developer account** at **cloud.higgsfield.ai**. The API is billed from a **separate pay-as-you-go API balance**, not your Higgsfield app subscription or app credits. Higgsfield's own blog mentions a $5 minimum top-up; confirm it in the console.
2. An **API key** (Key ID + Key Secret; the secret is shown only once).
3. Add it to `.env.local` and restart the app:
   ```bash
   HF_KEY=YOUR_KEY_ID:YOUR_KEY_SECRET
   ```
4. **Settings → Providers → Check credentials (free)** calls the status endpoint with a dummy ID. A 401 means the key is wrong; no generation is created.

When this was built, the connected Higgsfield **app** account was on the free plan with 9.85 app credits. That balance doesn't apply to the Cloud API, and API access couldn't be verified because no API key was configured.

### Pricing

Higgsfield's API pricing couldn't be fetched, and the API doesn't report per-request cost. The defaults in **Settings → Prices** (DoP Lite/Turbo/Standard $0.30/$0.50/$0.80, Soul $0.05–$0.10) are **unverified placeholders**. Edit them to match your dashboard, because budgets and confirmations use these numbers.

### Three ways to get Higgsfield clips into a project

| Workflow | Needs | How |
|---|---|---|
| **API (automatic)** | `HF_KEY` + funded API balance | AI Clips → *Make AI keyframe* → *Generate clip* (each step shows the estimate and asks you to confirm) |
| **Higgsfield app → import** | Your normal Higgsfield app credits | AI Clips → *Generate in Higgsfield app ▾*: download the keyframe, copy the exact prompt, generate in the app at 9:16, then *Import clip*. Imported clips are labelled "Higgsfield app (imported)". |
| **Demo placeholders** | Nothing | Free pan/zoom over the storyboard, permanently watermarked **"DEMO — NOT AI VIDEO"** and never presented as AI output |

The app **never switches to another paid provider on its own**. If Higgsfield isn't configured, you get the demo and import options, not Luma.

---

## Free vs paid

| Feature | Cost | Notes |
|---|---|---|
| Story writer: local composer | Free | Offline, template-driven, parses fruits/adjectives/goal from your idea. English only. |
| Story writer: Ollama / any OpenAI-compatible endpoint | Free if local | `OPENAI_COMPAT_BASE_URL=http://localhost:11434/v1`, `OPENAI_COMPAT_MODEL=llama3.1` |
| Story writer: Anthropic Claude | Paid (~$0.25/story estimate) | `ANTHROPIC_API_KEY`; model `ANTHROPIC_MODEL` (default `claude-opus-5-5`, set `claude-haiku-5-5` to save) |
| Storyboard & reference **sketches** | Free | Local SVG renderer, labelled "SKETCH · NOT AI". Never sent to AI models. |
| Keyframes & references: Higgsfield Soul | Paid | Confirm per image |
| Video clips: Higgsfield DoP | Paid | Confirm per clip |
| Video/images: Luma Ray / Photon | Paid, optional | `LUMA_API_KEY`; used only if selected in Settings |
| Voices: flite (built into FFmpeg) | Free | 5 voices, pitch/speed per character |
| Voices: Piper | Free | `pip install piper-tts`, download `.onnx` voices, set `PIPER_BIN` + `PIPER_VOICES_DIR` |
| Voices: record in browser / import files | Free | Per line, in the Video Editor |
| Sound effects | Free | 17 effects synthesized by FFmpeg, no samples or licences |
| Music | Free | Generated original bed (simple, royalty-free), or import your own track after confirming you hold the rights |
| Captions, editing, rendering, export | Free | FFmpeg |

---

## Cost controls

- **No surprise spend:** every paid request first returns `402` with the estimate. The UI shows it with your scene/project/month spend, and only re-sends with `confirmCost` plus that exact estimate. A stale estimate is refused.
- **Budgets:** per scene, per project (overridable per project), and per month. A request that would exceed any of them is blocked before anything is sent.
- **Idempotency:** each click carries a request ID, so double clicks and client retries reuse the same generation. Only one paid job per scene runs at a time.
- **No automatic retries** of paid work. Failed or moderated jobs show the reason; *Regenerate* is a new, confirmed request.
- **Cancel:** queued Higgsfield requests are cancelled at Higgsfield. Running ones can't be (Higgsfield finishes and bills them), and the UI says so.
- **Spend log:** Settings → Spend log. Luma's actual cost is measured from `/credits` when only one job was in flight; Higgsfield is tracked by estimate.
- **Reuse:** approved character references are reused for every keyframe. Voice lines are cached by content hash, so only changed lines are re-synthesized.

---

## Visual styles

Pick a preset on **New Story**:

- **Cute family-film fruit** (default): round, big-eyed Pixar-style fruit creatures with tiny limbs, for wholesome stories.
- **Fruit people · villa drama**: the viral TikTok look. Adult characters with realistic human bodies and photoreal fruit heads with human-like faces, a sunny luxury resort, and reality-show storylines (arrival, flirting, a rival, a "recoupling" text, the choice, a cliffhanger). Characters get stable outfits that are written into every prompt for consistency. Prompts ask for tasteful, non-suggestive outfits: Higgsfield's moderation rejects revealing content (refunded, but wasted time), and YouTube restricts ads on sexualised videos and thumbnails. The drama comes from situations and reactions.

Library characters are reused only within the same style, so a cartoon strawberry never shows up in a fruit-people project.

## Using the app

1. **New Story:** idea, genre, 15/30/45/60s, scene count, characters, dialogue, narrator, style, language, and writer.
2. **Script:** edit every scene (visual prompt, camera, characters, action/emotion, dialogue, narration, SFX, caption, duration), then reorder, add, delete, or rewrite. **Approve** to lock it.
3. **Characters & Storyboard:** the Character Bible (appearance, body/face/eyes/mouth/limbs, clothing, personality, palette, voice with preview). Generate or upload reference images, then **approve one**; it's reused in every scene. Sketch storyboards for free, and make AI keyframes when you're ready to animate.
4. **AI Clips:** per scene: plan (method, start frame, estimate), generate or regenerate, preview, **approve or reject**, takes history, cancel, or import from the Higgsfield app.
5. **Edit & Export:** timeline (scenes, voice, SFX, captions), voice generation and recording, music and caption options. **Preview** (540×960) → **Final** (1080×1920) → **approve** → **Export MP4** (+ SRT/VTT). Also the Shorts kit: 3 hooks, 3 titles, description, hashtags, pinned comment, and cover frames extracted from the final render.
6. **Render Queue / Export Library / Cost & API Settings.**

### The render pipeline (FFmpeg)

- Every clip is probed first. Missing or corrupt clips **fail the render with the scene number**; no fake video is produced.
- Any input size or frame rate is conformed to 9:16 at 30fps. Clips that aren't already 9:16 are letterboxed over a blurred fill of themselves, so nothing is **stretched or cropped**.
- Shots are held (last frame) when speech is longer than planned, so lines are never cut off.
- Transitions: cut, crossfade, or dip to black.
- Audio: voice lines placed sequentially per scene, SFX spread through each scene, music ducked under speech (sidechain), fades, loudness-normalised to about −14 LUFS.
- Captions: styled ASS burned in above the Shorts UI zone, plus SRT/VTT files.
- Output: H.264 High + AAC 192k, `+faststart`. Duration and streams are verified after encoding.
- Renders containing demo clips carry a corner "DEMO — NOT AI VIDEO" label, and exports get a `-DEMO` filename suffix.

---

## Architecture

- **Next.js 16 (App Router) + TypeScript + React 19 + Tailwind 4.** UI pages are client components talking to JSON API routes.
- **SQLite** (`better-sqlite3`, WAL), with append-only migrations in `src/lib/db.ts`.
- **Background worker** (`src/lib/jobs.ts`): a persistent job table, started from `instrumentation.ts`. Jobs interrupted by a restart are re-queued; their handlers are safe to re-run. A poller advances provider jobs; webhooks (optional, signed URLs) only trigger a fresh status fetch.
- **Provider abstraction** (`src/lib/providers/`): `GenProvider` with `submit / poll / cancel / download / estimate`. Implementations: Higgsfield Soul + DoP, Luma Photon + Ray, local sketch, demo clip. Adding fal.ai or another service is one file in the registry.
- **Generation engine** (`src/lib/generations.ts`): approvals, budgets, idempotency, unknown-outcome handling, takes.
- **Media:** `src/lib/media/` (sketch, TTS, SFX/music, timeline/captions), `src/lib/render.ts`, `src/lib/exports.ts`.
- **Security:** keys are read only server-side (`src/lib/config.ts`) and redacted from logs and errors. Media is served via a traversal-safe route with a type allow-list. Uploads are checked by extension, size, and ffprobe. AI providers fetch local keyframes only through HMAC-signed URLs (needs `PUBLIC_BASE_URL`; Higgsfield uploads to its own CDN instead). The app has **no login**: it's a local, single-user tool. Don't expose it to the internet without adding authentication.

---

## Honest limitations

- AI video models can still drift between scenes (faces, proportions, accessories) even with references. Review every clip; that's what the approve/reject loop is for.
- The local story composer is template-based. It's coherent, but less inventive than an LLM, and English only.
- flite voices are robotic-cute. Piper or recorded lines sound much better.
- The generated music bed is deliberately simple. Import licensed music for anything more polished.
- Higgsfield and Luma prices are user-editable estimates, not live quotes.
- No live call to Higgsfield's or Luma's API was possible from the build environment (network policy). Both adapters are tested against mocked transports that follow the official SDK contracts. Run *Check credentials* after adding your key.
