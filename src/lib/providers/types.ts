import type { Settings } from "../settings";

export type GenKind = "image" | "video";

export interface GenerationRecord {
  id: string;
  projectId: string | null;
  sceneId: string | null;
  characterId: string | null;
  kind: GenKind;
  provider: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  providerJobId: string | null;
  createdAt: number;
  submittedAt: number | null;
}

/** Result of a submission. Synchronous providers return the output file directly. */
export type SubmitResult = { providerJobId: string } | { output: { file: string; remoteUrl?: string | null; meta?: Record<string, unknown> } };

export interface PollResult {
  state: "queued" | "generating" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
}

export interface ModelOption {
  id: string;
  label: string;
  resolutions?: string[];
  durations?: string[];
}

export interface GenProvider {
  id: string;
  label: string;
  kind: GenKind;
  /** True when requests cost real money. */
  paid: boolean;
  /** True for clearly-labelled local placeholders (never presented as AI output). */
  demo: boolean;
  configured(): { ok: boolean; reason?: string };
  models(): ModelOption[];
  estimate(settings: Settings, model: string, params: Record<string, unknown>): number;
  submit(gen: GenerationRecord): Promise<SubmitResult>;
  poll?(gen: GenerationRecord): Promise<PollResult>;
  /** Try to find a job the provider received even though our request timed out. */
  reconcile?(gen: GenerationRecord): Promise<string | null>;
  cancel?(gen: GenerationRecord): Promise<void>;
  /** Download a completed remote output to a local file. */
  download?(url: string, dest: string): Promise<void>;
  /** Account balance in USD, when the provider exposes it (for measuring actual cost). */
  balanceUsd?(): Promise<number | null>;
}

/** The request reached (or may have reached) the provider but we don't know the outcome. Never auto-resubmit. */
export class UnknownOutcomeError extends Error {}
/** The provider definitively rejected the request (bad params, auth, quota...). */
export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}
