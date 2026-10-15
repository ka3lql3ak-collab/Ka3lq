import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { enqueue } from "@/lib/jobs";
import { requireProject, updateProject, listScenes, PaymentRequiredError, ValidationError } from "@/lib/repo";
import { capabilities, getSettings } from "@/lib/settings";
import { checkBudget } from "@/lib/costs";
import { config } from "@/lib/config";
import { recordPaidStory } from "@/lib/features/story-jobs";
import { StorySettingsSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

const GenSchema = z.object({
  variation: z.number().int().min(0).max(1000).default(0),
  settings: StorySettingsSchema.optional(),
  confirmCost: z.boolean().default(false),
  estimate: z.number().optional(),
});

/** Start (re)generating the story. Paid providers require explicit cost confirmation. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const p = requireProject(id);
  const body = GenSchema.parse(await readJson(req));
  if (body.settings) updateProject(id, { settings: body.settings });
  const settings = body.settings ?? p.settings;
  let generationId: string | undefined;
  if (settings.storyProvider === "anthropic") {
    if (!capabilities().anthropic) throw new ValidationError("Anthropic is not configured. Add ANTHROPIC_API_KEY or pick the free local composer.");
    const estimate = getSettings().prices.storyLlm;
    const budget = checkBudget({ projectId: id, estimate, projectBudget: p.budgetUsd });
    if (!body.confirmCost || body.estimate === undefined || Math.abs(body.estimate - estimate) > 1e-6) {
      throw new PaymentRequiredError("Confirm the estimated cost before writing with a paid model.", { estimate, budget, provider: "anthropic", model: config.anthropic.model });
    }
    if (!budget.ok) throw new PaymentRequiredError(budget.reasons.join(" "), { estimate, budget, blocked: true });
    generationId = recordPaidStory(id, "anthropic", config.anthropic.model, estimate);
  }
  const job = enqueue("story.generate", { projectId: id, variation: body.variation, generationId }, id, { dedupeKey: `story:${id}` });
  return { job };
});

const EditSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  logline: z.string().max(400).optional(),
  hook: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
});

/** Edit story-level fields (scene edits go through the scenes API). */
export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const p = requireProject(id);
  if (!p.story) throw new ValidationError("Generate a story first.");
  const patch = EditSchema.parse(await readJson(req));
  const story = { ...p.story, ...patch };
  return { project: updateProject(id, { story, title: patch.title ?? p.title, scriptApproved: false }) };
});

const ApproveSchema = z.object({ approved: z.boolean() });

/** Approve (lock) or unlock the script. */
export const PUT = route<{ id: string }>(async (req, { id }) => {
  requireProject(id);
  const { approved } = ApproveSchema.parse(await readJson(req));
  if (approved && listScenes(id).length < 2) throw new ValidationError("A script needs at least 2 scenes before it can be approved.");
  return { project: updateProject(id, { scriptApproved: approved, status: approved ? "storyboard" : "script" }) };
});
