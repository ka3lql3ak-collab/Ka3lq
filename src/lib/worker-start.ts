import "server-only";
import { startWorker } from "./jobs";
import { registerAllHandlers } from "./handlers";

let started = false;
export function ensureWorker() {
  if (started) return;
  started = true;
  registerAllHandlers();
  startWorker();
}
