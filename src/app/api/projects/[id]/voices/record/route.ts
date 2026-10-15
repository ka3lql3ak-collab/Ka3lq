import { route } from "@/lib/api";
import { requireProject, ValidationError } from "@/lib/repo";
import { mediaDir } from "@/lib/paths";
import { saveUpload } from "@/lib/uploads";
import { saveRecordedLine } from "@/lib/features/voice";

/** Upload a recorded (browser microphone) or imported take for one line. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const form = await req.formData();
  const sceneId = String(form.get("sceneId") ?? "");
  const key = String(form.get("key") ?? "");
  if (!/^[a-f0-9]{20}$/.test(key) || !sceneId) throw new ValidationError("sceneId and a valid line key are required.");
  const { abs } = await saveUpload(form.get("file") as File, "audio", mediaDir("projects", id, "voice"));
  return { asset: await saveRecordedLine(id, sceneId, key, abs) };
});
