import { route } from "@/lib/api";
import { createAsset, requireProject, ValidationError } from "@/lib/repo";
import { mediaDir, toRel } from "@/lib/paths";
import { saveUpload } from "@/lib/uploads";
import { saveEditorOptions } from "@/lib/features/voice";

/** Import background music. Requires an explicit statement that you have the rights to use it. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const form = await req.formData();
  if (form.get("licenseConfirmed") !== "true") throw new ValidationError("Confirm that you own or are licensed to use this music. Copyrighted music without permission can get your Short blocked or muted.");
  const { abs, info } = await saveUpload(form.get("file") as File, "audio", mediaDir("projects", id, "music"));
  const asset = createAsset({ projectId: id, kind: "music", path: toRel(abs), provider: "upload", meta: { durationSec: info.durationSec, originalName: String((form.get("file") as File).name).slice(0, 120), license: String(form.get("licenseNote") ?? "").slice(0, 300), licenseConfirmedAt: Date.now() } });
  saveEditorOptions(id, { music: "upload", musicAssetId: asset.id, musicLicenseConfirmed: true });
  return { asset };
});
