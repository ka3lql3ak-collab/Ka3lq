import { route } from "@/lib/api";
import { cancelGeneration } from "@/lib/generations";

export const POST = route<{ id: string }>(async (_req, { id }) => ({ generation: await cancelGeneration(id) }));
