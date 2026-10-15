import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requestStoryboard } from "@/lib/features/visuals";

const Schema = z.object({ providerId: z.string().optional(), model: z.string().optional(), requestId: z.string(), confirmCost: z.boolean().optional(), estimate: z.number().optional() });

export const POST = route<{ id: string; sceneId: string }>(async (req, { id, sceneId }) => requestStoryboard(id, sceneId, Schema.parse(await readJson(req))));
