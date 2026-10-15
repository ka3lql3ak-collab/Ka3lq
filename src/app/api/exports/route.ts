import { route } from "@/lib/api";
import { listExports } from "@/lib/exports";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => ({ exports: listExports({ q: new URL(req.url).searchParams.get("q")?.slice(0, 80) || undefined }) }));
