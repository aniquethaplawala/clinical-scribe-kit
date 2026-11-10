"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Select } from "@/components/ui/Field";
import { api, asAppError } from "@/lib/client";
import type { AppError, SampleSummary } from "@/lib/types";

/** Paste a transcript, upload a .txt file, or load one of the repo's sample encounters. */
export function TranscriptInput({
  samples,
  onTranscript,
}: {
  samples: SampleSummary[];
  onTranscript: (transcript: string, sampleId?: string) => void;
}) {
  const [sampleId, setSampleId] = useState("");
  const [error, setError] = useState<AppError | null>(null);

  async function loadSample(id: string) {
    setSampleId(id);
    setError(null);
    if (!id) return;
    try {
      const { transcript } = await api<{ transcript: string }>(`/api/samples?id=${encodeURIComponent(id)}`);
      onTranscript(transcript, id);
    } catch (err) {
      setError(asAppError(err));
    }
  }

  async function loadFile(file: File | undefined) {
    setError(null);
    setSampleId("");
    if (!file) return;
    if (file.size > 1_000_000) {
      setError({ title: "File too large", message: "Transcripts can be at most 100,000 characters." });
      return;
    }
    onTranscript(await file.text(), undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Load sample" htmlFor="transcript-sample">
          <Select id="transcript-sample" value={sampleId} onChange={(e) => loadSample(e.target.value)}>
            <option value="">Choose a sample</option>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Or upload a .txt file" htmlFor="transcript-file">
          <label
            htmlFor="transcript-file"
            className="flex cursor-pointer items-center gap-2 rounded-[4px] border border-dashed border-silver bg-paper px-3 py-2.5 text-[16px] text-graphite hover:border-ink focus-within:outline-2 focus-within:outline-ink"
          >
            <FileText aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            Choose text file
            <input id="transcript-file" type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => loadFile(e.target.files?.[0])} />
          </label>
        </Field>
      </div>
      {error ? <ErrorNotice error={error} /> : null}
    </div>
  );
}
