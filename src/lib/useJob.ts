"use client";
import { useEffect, useState } from "react";
import { api } from "./client";

export interface JobView {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  message: string | null;
  error: string | null;
  result: unknown;
}

/** Poll a background job until it finishes. */
export function useJob(jobId: string | null, onDone?: (j: JobView) => void) {
  const [job, setJob] = useState<JobView | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const { job } = await api<{ job: JobView }>(`/api/jobs/${jobId}`);
        if (!alive) return;
        setJob(job);
        if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
          onDone?.(job);
          return;
        }
      } catch {
        /* transient */
      }
      t = setTimeout(tick, 900);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  return job;
}
