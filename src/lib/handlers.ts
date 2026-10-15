import "server-only";
import { registerStoryHandlers } from "./features/story-jobs";
import { registerGenerationHandlers } from "./generations";

/** Registers every background job handler. */
export function registerAllHandlers() {
  registerStoryHandlers();
  registerGenerationHandlers();
}
