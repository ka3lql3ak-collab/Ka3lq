import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requestReference } from "@/lib/features/visuals";

const Schema = z.object({ providerId: z.string().optional(), model: z.string().optional(), requestId: z.string(), confirmCost: z.boolean().optional(), estimate: z.number().optional(), visualStyle: z.string().optional() });

export const POST = route<{ id: string }>(async (req, { id }) => requestReference(id, Schema.parse(await readJson(req))));
