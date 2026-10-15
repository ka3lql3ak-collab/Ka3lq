"use client";
import { useRef, useState } from "react";
import { api, useApi } from "@/lib/client";
import { useJob } from "@/lib/useJob";
import { Badge, Button, Card, ErrorBox, Progress, useToast, cx } from "../ui";

interface Line {
  sceneId: string;
  index: number;
  speaker: string;
  text: string;
  key: string;
  voice: { engine: string; voice: string };
  asset: { id: string; url: string } | null;
  durationSec: number | null;
  needsRecording: boolean;
}
interface VoiceData {
  scenes: { sceneId: string; idx: number; durationSec: number; lines: Line[] }[];
}

export function VoicePanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, reload } = useApi<VoiceData>(`/api/projects/${projectId}/voices`);
  const [jobId, setJobId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const job = useJob(jobId, (j) => {
    if (j.status === "failed") setErr(j.error);
    setJobId(null);
    reload();
    onChanged();
  });
  const lines = data?.scenes.flatMap((s) => s.lines.map((l) => ({ ...l, sceneIdx: s.idx }))) ?? [];
  const missing = lines.filter((l) => !l.asset && !l.needsRecording).length;
  const toRecord = lines.filter((l) => l.needsRecording).length;

  async function generate() {
    setErr(null);
    try {
      const r = await api<{ job: { id: string } }>(`/api/projects/${projectId}/voices`, { body: {} });
      setJobId(r.job.id);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg font-semibold text-white">Voiceover</div>
          <div className="text-xs text-ink-400">
            {lines.length} lines · {missing} to generate · {toRecord} to record. Voices are set per character in the Character Bible. Generation is local and free.
          </div>
        </div>
        <Button variant="primary" onClick={generate} loading={!!jobId} disabled={missing === 0}>Generate voices (free)</Button>
      </div>
      {jobId && (
        <div className="mb-3 space-y-1">
          <div className="text-xs text-ink-400">{job?.message ?? "Queued…"}</div>
          <Progress value={job?.progress ?? 0.05} />
        </div>
      )}
      <ErrorBox error={err} className="mb-3" />
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1 scroll-thin">
        {lines.map((l) => (
          <LineRow key={`${l.sceneId}-${l.key}`} projectId={projectId} line={l} sceneIdx={l.sceneIdx} onSaved={() => { reload(); onChanged(); }} />
        ))}
        {!data && <div className="shimmer h-24 rounded-lg" />}
        {data && lines.length === 0 && <div className="py-4 text-center text-sm text-ink-500">No narration or dialogue in this script.</div>}
      </div>
    </Card>
  );
}

function LineRow({ projectId, line, sceneIdx, onSaved }: { projectId: string; line: Line; sceneIdx: number; onSaved: () => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  async function send(blob: Blob, name: string) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", new File([blob], name));
      form.set("sceneId", line.sceneId);
      form.set("key", line.key);
      await api(`/api/projects/${projectId}/voices/record`, { form });
      toast("Take saved");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function toggleRecord() {
    if (rec) {
      rec.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        send(new Blob(chunks, { type: mr.mimeType }), "take.webm");
      };
      mr.start();
      setRec(mr);
    } catch {
      toast("Microphone access was denied or isn't available. Use Import instead.", "error");
    }
  }
  return (
    <div className={cx("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm", line.asset ? "border-ink-800" : line.needsRecording ? "border-amber-500/30" : "border-ink-800")}>
      <span className="w-8 text-xs text-ink-500">S{sceneIdx + 1}</span>
      <span className="w-24 truncate font-semibold text-ink-200">{line.speaker}</span>
      <span className="min-w-0 flex-1 truncate text-ink-300" title={line.text}>{line.text}</span>
      {line.asset ? (
        <>
          <audio src={line.asset.url} controls className="h-8 w-44" preload="none" />
          <span className="text-xs text-ink-500">{line.durationSec?.toFixed(1)}s</span>
        </>
      ) : line.needsRecording ? (
        <Badge tone="awaiting_approval">record me</Badge>
      ) : (
        <Badge tone="pending">not generated</Badge>
      )}
      {(line.voice.engine === "recorded" || line.asset) && (
        <span className="flex gap-1">
          <Button size="sm" variant={rec ? "danger" : "ghost"} onClick={toggleRecord} loading={busy} title="Record with your microphone">{rec ? "■ Stop" : "● Rec"}</Button>
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} title="Import an audio file for this line">⇪</Button>
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && send(e.target.files[0], e.target.files[0].name)} />
        </span>
      )}
    </div>
  );
}
