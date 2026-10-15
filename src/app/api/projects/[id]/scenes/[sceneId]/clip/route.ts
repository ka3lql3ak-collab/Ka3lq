import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { clipPrompt, planClip, requestClip } from "@/lib/features/visuals";

export const dynamic = "force-dynamic";

const Opts = z.object({ providerId: z.string().optional(), model: z.string().optional(), resolution: z.enum(["540p", "720p", "1080p", "4k"]).optional(), duration: z.enum(["5s", "9s"]).optional(), useKeyframe: z.boolean().optional() });
const Schema = Opts.extend({ requestId: z.string(), confirmCost: z.boolean().optional(), estimate: z.number().optional() });

/** Preview the plan (mode, keyframe, estimate) without spending anything. */
export const GET = route<{ id: string; sceneId: string }>(async (req, { id, sceneId }) => {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const o = Opts.parse({ ...q, useKeyframe: q.useKeyframe === undefined ? undefined : q.useKeyframe !== "false" });
  return { plan: planClip(id, sceneId, o), prompt: clipPrompt(id, sceneId) };
});

export const POST = route<{ id: string; sceneId: string }>(async (req, { id, sceneId }) => requestClip(id, sceneId, Schema.parse(await readJson(req))));
