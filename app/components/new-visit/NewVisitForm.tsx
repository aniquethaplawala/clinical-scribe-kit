"use client";

import { FileText, LoaderCircle, Mic, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { asAppError, postJson } from "@/lib/client";
import type { AppError, EhrSummary, InputMethod, Provider, SampleSummary, TemplateSummary, Visit } from "@/lib/types";
import { AudioUpload } from "./AudioUpload";
import { LiveCapture, type StreamSummary } from "./LiveCapture";
import { TranscriptInput } from "./TranscriptInput";

const METHODS: Array<{ id: InputMethod; label: string; icon: typeof Mic }> = [
  { id: "upload", label: "Upload audio", icon: Upload },
  { id: "paste", label: "Paste transcript", icon: FileText },
  { id: "live", label: "Live conversation", icon: Mic },
];
const MAX_TRANSCRIPT = 100_000;

/** New visit for the logged-in provider. Template and EHR start from their profile. */
export function NewVisitForm({
  provider,
  templates,
  ehrs,
  samples,
  demo,
}: {
  provider: Provider;
  templates: TemplateSummary[];
  ehrs: EhrSummary[];
  samples: SampleSummary[];
  demo: boolean;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(provider.defaultTemplateId || templates[0]?.id || "");
  const [ehrKey, setEhrKey] = useState(provider.defaultEhrKey || ehrs[0]?.key || "");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [method, setMethod] = useState<InputMethod>("paste");
  const [transcript, setTranscript] = useState("");
  const [sampleId, setSampleId] = useState<string | undefined>();
  const [callIds, setCallIds] = useState<string[]>([]);
  const [stream, setStream] = useState<StreamSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  function receiveTranscript(text: string, fromSample?: string) {
    setTranscript(text);
    setSampleId(fromSample);
    setError(null);
    // Prefill patient age and gender from the sample's metadata when the fields are empty.
    const sample = samples.find((s) => s.id === fromSample);
    if (sample?.patient) {
      if (!patientAge && sample.patient.age !== undefined) setPatientAge(String(sample.patient.age));
      if (!patientGender && sample.patient.gender) setPatientGender(sample.patient.gender);
    }
  }

  const addCall = (id: string) => setCallIds((ids) => (ids.includes(id) ? ids : [...ids, id]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!transcript.trim()) return setError({ title: "No transcript yet", message: "Add a transcript before generating the note." });
    if (transcript.length > MAX_TRANSCRIPT) {
      return setError({ title: "Transcript too long", message: "Sully accepts transcripts up to 100,000 characters." });
    }
    setSubmitting(true);
    try {
      const { visit } = await postJson<{ visit: Visit }>("/api/visits", {
        templateId,
        ehrKey,
        patient: { name: patientName, age: patientAge === "" ? undefined : Number(patientAge), gender: patientGender },
        inputMethod: method,
        sampleId,
        transcript,
        callIds,
        stream: method === "live" ? stream : undefined,
      });
      router.push(`/visits/${visit.id}`);
    } catch (err) {
      setError(asAppError(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      {/* Visit details */}
      <section aria-labelledby="details-title" className="flex h-fit flex-col gap-5 rounded-[16px] bg-paper p-6 md:p-8">
        <h2 id="details-title" className="text-[18px] font-medium">
          Visit details
        </h2>
        <Field label="Patient name (optional)" htmlFor="patient-name">
          <Input id="patient-name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. Jordan Lee" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Age (optional)" htmlFor="patient-age">
            <Input
              id="patient-age"
              type="number"
              min={0}
              max={150}
              step={1}
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
            />
          </Field>
          <Field label="Gender (optional)" htmlFor="patient-gender">
            <Select id="patient-gender" value={patientGender} onChange={(e) => setPatientGender(e.target.value)}>
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="nonbinary">Nonbinary</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Note template" htmlFor="template">
          <Select id="template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target EHR" htmlFor="ehr">
          <Select id="ehr" value={ehrKey} onChange={(e) => setEhrKey(e.target.value)}>
            {ehrs.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      {/* Conversation */}
      <section aria-labelledby="conversation-title" className="flex flex-col gap-6 rounded-[16px] bg-paper p-6 md:p-8">
        <div className="flex flex-col gap-4">
          <h2 id="conversation-title" className="text-[18px] font-medium">
            Conversation
          </h2>
          <div role="tablist" aria-label="Input method" className="inline-flex w-fit flex-wrap gap-1 rounded-full border border-fog p-1">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="method-panel"
                  onClick={() => setMethod(m.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] ${active ? "bg-ink font-medium text-paper" : "text-ink hover:bg-cream"}`}
                >
                  <Icon aria-hidden className="h-4 w-4" strokeWidth={1.5} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div id="method-panel" role="tabpanel">
          {method === "upload" ? <AudioUpload samples={samples} onTranscript={receiveTranscript} onCall={addCall} /> : null}
          {method === "paste" ? <TranscriptInput samples={samples} onTranscript={receiveTranscript} /> : null}
          {method === "live" ? (
            <LiveCapture
              demo={demo}
              onCall={addCall}
              onTranscript={(text, summary) => {
                receiveTranscript(text, undefined);
                setStream(summary);
              }}
            />
          ) : null}
        </div>

        <Field
          label="Transcript"
          htmlFor="transcript"
          hint={`${transcript.length.toLocaleString()} / 100,000`}
        >
          <Textarea
            id="transcript"
            rows={12}
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
            }}
            placeholder={"Clinician: What brings you in today?\nPatient: I've had a dry cough for three days."}
          />
        </Field>

        {error ? <ErrorNotice error={error} /> : null}

        <div className="flex justify-end border-t border-fog pt-6">
          <Button type="submit" disabled={submitting || !transcript.trim()}>
            {submitting ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : null}
            {submitting ? "Generating note..." : "Generate note"}
          </Button>
        </div>
      </section>
    </form>
  );
}
