/**
 * The scribe pipeline, step by step. Each step records its Sully calls on the visit.
 *
 *   1. note   POST /v3/notes                     transcript + template -> note
 *   2. codes  POST /openai/v1/chat/completions   note -> suggested codes (Sully M1)
 *   3. ehr    POST /v1/utils/text-to-json        note + EHR schema -> structured data
 *
 * Steps 2 and 3 run in parallel once the note exists.
 */
import { buildCodingRequest, M1_MODEL, parseCodingReply } from "./coding";
import { demoCodes, demoEhrData, formatReferenceNote, placeholderNote } from "./demo";
import { toAppError } from "./errors";
import { loadEhrSchema, loadSampleReferenceNote, loadTemplate } from "./kit";
import { updateVisit } from "./store";
import { generateNote, m1ChatCompletion, SullyError, textToJson, type ClinicalContext, type InlineTemplate } from "./sully";
import type { ApiCall, AppError, PatientInfo, Visit } from "./types";

/** A step stuck in "running" for this long (e.g. the server restarted) can be started again. */
const STALE_MS = 6 * 60_000;

export function isRunning(step: { status: string; startedAt?: string } | undefined): boolean {
  if (!step || step.status !== "running") return false;
  return !step.startedAt || Date.now() - Date.parse(step.startedAt) < STALE_MS;
}

// ---------- Limits from the Note Generation v3 docs ----------

const MAX_TRANSCRIPT = 100_000;
const MAX_TEMPLATE_AND_CONTEXT = 100_000;
const MAX_TEXT_TO_JSON = 50_000;

function textLength(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce((n, v) => n + textLength(v), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((n: number, v) => n + textLength(v), 0);
  return 0;
}

/** Returns an error message if the request would break a documented limit, otherwise null. */
export function checkNoteLimits(transcript: string, template: InlineTemplate, context: ClinicalContext): string | null {
  if (!transcript.trim()) return "The transcript is empty. Add a transcript before generating a note.";
  if (transcript.length > MAX_TRANSCRIPT) {
    return `The transcript is ${transcript.length.toLocaleString()} characters. Sully accepts up to 100,000.`;
  }
  if (textLength(template) + textLength(context) > MAX_TEMPLATE_AND_CONTEXT) {
    return "The template and clinical context together exceed 100,000 characters.";
  }
  const age = context.patient?.age;
  if (age !== undefined && (!Number.isInteger(age) || age < 0 || age > 150)) {
    return "Patient age must be a whole number from 0 to 150.";
  }
  return null;
}

export function buildClinicalContext(patient: PatientInfo): ClinicalContext {
  const p: NonNullable<ClinicalContext["patient"]> = {};
  if (patient.name) p.name = patient.name;
  if (patient.age !== undefined) p.age = patient.age;
  if (patient.gender) p.gender = patient.gender;
  return Object.keys(p).length ? { patient: p } : {};
}

function failure(err: unknown): { error: AppError; call?: ApiCall } {
  if (err instanceof SullyError) return { error: err.appError, call: err.call };
  return { error: toAppError(err) };
}

// ---------- Step 1: note ----------

export async function runNote(visitId: string): Promise<Visit> {
  const visit = await updateVisit(visitId, (v) => {
    v.note = { status: "running", startedAt: new Date().toISOString() };
  });
  const template = await loadTemplate(visit.templateId);
  try {
    if (!template) throw new Error(`Template "${visit.templateId}" was not found in ../templates.`);
    const clinicalContext = buildClinicalContext(visit.patient);
    const limitError = checkNoteLimits(visit.transcript, template, clinicalContext);
    if (limitError) throw new Error(limitError);

    const body = {
      transcript: visit.transcript,
      template,
      ...(clinicalContext.patient ? { clinicalContext } : {}),
    };
    const reference = visit.sampleId ? await loadSampleReferenceNote(visit.sampleId) : undefined;
    const { data, call } = await generateNote(body, () => ({
      requestId: "demo_note",
      note: reference ? formatReferenceNote(reference) : placeholderNote(template, visit.transcript),
    }));
    return updateVisit(visitId, (v) => {
      v.note = { status: "done", result: { note: data.note, requestId: data.requestId ?? call.requestId } };
      v.calls.push(call);
    });
  } catch (err) {
    const { error, call } = failure(err);
    return updateVisit(visitId, (v) => {
      v.note = { status: "error", error };
      if (call) v.calls.push(call);
    });
  }
}

// ---------- Step 2: codes (Sully M1) ----------

export async function runCodes(visitId: string): Promise<Visit> {
  const visit = await updateVisit(visitId, (v) => {
    v.codes = { status: "running", startedAt: new Date().toISOString() };
  });
  const note = visit.note.result?.note ?? "";
  try {
    if (!note) throw new Error("Generate the note first.");
    const request = buildCodingRequest(note, visit.patient);
    const { data, call } = await m1ChatCompletion(request, "Suggest codes (Sully M1)", () => ({
      id: "chatcmpl-demo",
      model: M1_MODEL,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              codes: demoCodes(note).map((c) => ({ system: c.system, code: c.code, description: c.description, evidence: c.evidence, confidence: c.confidence })),
            }),
          },
          finish_reason: "stop",
        },
      ],
    }));
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? "";
    if (!visit.demo && !content.trim() && choice?.finish_reason === "length") {
      await updateVisit(visitId, (v) => void v.calls.push(call));
      throw new Error("Sully M1 ran out of tokens before answering. Try Suggest again.");
    }
    let parsed: ReturnType<typeof parseCodingReply>;
    try {
      parsed = visit.demo ? { codes: demoCodes(note), removed: 0 } : parseCodingReply(content, note);
    } catch (err) {
      await updateVisit(visitId, (v) => void v.calls.push(call));
      throw err;
    }
    return updateVisit(visitId, (v) => {
      v.codes = { status: "done", result: parsed };
      v.calls.push(call);
    });
  } catch (err) {
    const { error, call } = failure(err);
    return updateVisit(visitId, (v) => {
      v.codes = { status: "error", error };
      if (call) v.calls.push(call);
    });
  }
}

// ---------- Step 3: EHR JSON ----------

export async function runEhr(visitId: string, ehrKey: string): Promise<Visit> {
  const visit = await updateVisit(visitId, (v) => {
    v.selectedEhrKey = ehrKey;
    v.ehr[ehrKey] = { status: "running", startedAt: new Date().toISOString() };
  });
  const note = visit.note.result?.note ?? "";
  try {
    if (!note) throw new Error("Generate the note first.");
    const schema = await loadEhrSchema(ehrKey);
    if (!schema) throw new Error(`EHR "${ehrKey}" was not found in ../ehr-schemas.`);
    if (note.length > MAX_TEXT_TO_JSON) {
      throw new Error(`The note is ${note.length.toLocaleString()} characters. Text to JSON accepts up to 50,000.`);
    }

    const { data, call } = await textToJson({ text: note, schema }, () => ({ data: demoEhrData(note, schema) }));

    return updateVisit(visitId, (v) => {
      v.ehr[ehrKey] = { status: "done", result: { ehrKey, data: data.data } };
      v.calls.push(call);
    });
  } catch (err) {
    const { error, call } = failure(err);
    return updateVisit(visitId, (v) => {
      v.ehr[ehrKey] = { status: "error", error };
      if (call) v.calls.push(call);
    });
  }
}
