import "server-only";
import { registerStoryHandlers } from "./features/story-jobs";
import { registerGenerationHandlers } from "./generations";
import { registerVoiceHandlers } from "./features/voice";
import { registerRenderHandlers } from "./render";

/** Registers every background job handler. */
export function registerAllHandlers() {
  registerStoryHandlers();
  registerGenerationHandlers();
  registerVoiceHandlers();
  registerRenderHandlers();
}
