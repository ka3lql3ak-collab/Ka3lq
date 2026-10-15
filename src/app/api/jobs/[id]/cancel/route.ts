import { route } from "@/lib/api";
import { cancelJob } from "@/lib/jobs";

export const POST = route<{ id: string }>(async (_req, { id }) => ({ cancelled: cancelJob(id) }));
