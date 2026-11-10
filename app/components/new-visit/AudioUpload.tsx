"use client";

import { FileAudio, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Select } from "@/components/ui/Field";
import { api, asAppError, ClientError } from "@/lib/client";
import type { AppError, SampleSummary } from "@/lib/types";

type Phase = "idle" | "uploading" | "pending" | "processing" | "completed";
type CreateResponse = { id: string; status: string; callId: string };
type PollResponse = { id: string; status: string; transcript?: string; callId?: string; sampleId?: string };

const MAX_BYTES = 100 * 1024 * 1024;
const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  uploading: "Uploading",
  pending: "Queued",
  processing: "Transcribing",
  completed: "Transcript ready",
};

/**
 * Upload a finished recording: POST /v2/audio/transcriptions, then poll
 * GET /v2/audio/transcriptions/:id until it is completed or failed.
 */
export function AudioUpload({
  samples,
  onTranscript,
  onCall,
}: {
  samples: SampleSummary[];
  onTranscript: (transcript: string, sampleId?: string) => void;
  onCall: (callId: string) => void;
}) {
  const audioSamples = samples.filter((s) => s.hasAudio);
  const [file, setFile] = useState<File | null>(null);
  const [sampleId, setSampleId] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<AppError | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const previewRef = useRef("");
  useEffect(() => () => URL.revokeObjectURL(previewRef.current), []);

  /** Keeps the chosen file and a preview URL for the audio player in sync. */
  function setAudio(f: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = f ? URL.createObjectURL(f) : "";
    setPreviewUrl(previewRef.current);
    setFile(f);
  }

  function chooseFile(f: File | null) {
    setError(null);
    setPhase("idle");
    setSampleId("");
    if (f && f.size > MAX_BYTES) {
      setError({ title: "File too large", message: "Audio files can be at most 100 MiB." });
      return;
    }
    setAudio(f);
  }

  async function chooseSample(id: string) {
    setError(null);
    setPhase("idle");
    setSampleId(id);
    if (!id) return setAudio(null);
    setLoadingSample(true);
    try {
      const res = await fetch(`/api/samples/audio?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("This sample has no audio file in the repo.");
      const blob = await res.blob();
      setAudio(new File([blob], `${id.split("/")[1]}.mp3`, { type: "audio/mpeg" }));
    } catch (err) {
      setError(asAppError(err));
      setAudio(null);
    } finally {
      setLoadingSample(false);
    }
  }

  async function transcribe() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    const form = new FormData();
    form.append("audio", file, file.name);
    if (sampleId) form.append("sampleId", sampleId);
    try {
      const created = await api<CreateResponse>("/api/transcriptions", { method: "POST", body: form });
      onCall(created.callId);
      setPhase("pending");
      // Poll with a gentle backoff. GET requests are safe to repeat.
      let delay = 1500;
      for (let poll = 1; poll <= 400 && !cancelled.current; poll++) {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay + 500, 5000);
        const status = await api<PollResponse>(`/api/transcriptions/${encodeURIComponent(created.id)}?poll=${poll}`);
        if (status.status === "processing") setPhase("processing");
        if (status.status === "completed") {
          if (status.callId) onCall(status.callId);
          setPhase("completed");
          onTranscript(status.transcript ?? "", status.sampleId || sampleId || undefined);
          return;
        }
      }
      if (!cancelled.current) throw new Error("Transcription is taking longer than expected. Try again later.");
    } catch (err) {
      if (err instanceof ClientError && typeof err.body.callId === "string") onCall(err.body.callId);
      setError(asAppError(err));
      setPhase("idle");
    }
  }

  const busy = phase === "uploading" || phase === "pending" || phase === "processing";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Use a sample recording" htmlFor="audio-sample">
          <Select id="audio-sample" value={sampleId} onChange={(e) => chooseSample(e.target.value)} disabled={busy}>
            <option value="">Choose a sample</option>
            {audioSamples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Or upload your own" htmlFor="audio-file">
          <label
            htmlFor="audio-file"
            className="flex cursor-pointer items-center gap-2 rounded-[4px] border border-dashed border-silver bg-paper px-3 py-2.5 text-[16px] text-graphite hover:border-ink focus-within:outline-2 focus-within:outline-ink"
          >
            <Upload aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            Choose audio file
            <input
              id="audio-file"
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
              className="sr-only"
              disabled={busy}
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
      </div>

      {loadingSample ? (
        <p className="flex items-center gap-2 text-[14px] text-graphite">
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.5} /> Loading sample audio
        </p>
      ) : null}

      {file ? (
        <div className="flex flex-col gap-4 rounded-[16px] bg-cream p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FileAudio aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{file.name}</p>
              <p className="text-[12px] text-graphite">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </div>
          {previewUrl ? <audio controls src={previewUrl} className="h-10 w-full sm:w-64" aria-label="Preview audio" /> : null}
          <Button onClick={transcribe} disabled={busy}>
            {busy ? "Transcribing..." : phase === "completed" ? "Transcribe again" : "Transcribe"}
          </Button>
        </div>
      ) : null}

      {phase !== "idle" ? (
        <p role="status" className="flex items-center gap-2 text-[14px] text-graphite">
          {busy ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : null}
          {PHASE_LABEL[phase]}
        </p>
      ) : null}
      {error ? <ErrorNotice error={error} /> : null}
    </div>
  );
}
