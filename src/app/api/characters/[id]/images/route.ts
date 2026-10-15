import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { createAsset, deleteAsset, getAsset, requireCharacter, setAssetApproval, setCharacterApprovedImage, listAssets, ValidationError } from "@/lib/repo";
import { mediaDir, toRel } from "@/lib/paths";
import { saveUpload } from "@/lib/uploads";

/** Upload your own reference image. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  requireCharacter(id);
  const form = await req.formData();
  const { abs, info } = await saveUpload(form.get("file") as File, "image", mediaDir("characters", id, "references"));
  return { asset: createAsset({ characterId: id, kind: "reference", path: toRel(abs), provider: "upload", meta: { width: info.width, height: info.height } }) };
});

const Schema = z.object({ assetId: z.string(), action: z.enum(["approve", "reject", "delete"]) });

/** Approve (becomes THE reference reused in every scene), reject, or delete a reference image. */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const c = requireCharacter(id);
  const { assetId, action } = Schema.parse(await readJson(req));
  const a = getAsset(assetId);
  if (!a || a.characterId !== id || a.kind !== "reference") throw new ValidationError("Image not found for this character.");
  if (action === "approve") {
    for (const other of listAssets({ characterId: id, kind: "reference" })) if (other.id !== assetId && other.approval === "approved") setAssetApproval(other.id, "pending");
    setAssetApproval(assetId, "approved");
    setCharacterApprovedImage(id, assetId);
  } else if (action === "reject") {
    setAssetApproval(assetId, "rejected");
    if (c.approvedImageId === assetId) setCharacterApprovedImage(id, null);
  } else {
    if (c.approvedImageId === assetId) setCharacterApprovedImage(id, null);
    deleteAsset(assetId);
  }
  return { character: requireCharacter(id) };
});
