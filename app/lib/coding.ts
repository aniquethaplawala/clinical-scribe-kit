/**
 * Suggested ICD-10-CM and CPT codes from a generated note, using Sully M1.
 *
 * Sully's dedicated Medical Coding API is not public yet, so this uses M1 chat
 * completions with JSON output. Every suggestion must quote the note; codes
 * whose quote cannot be found in the note are dropped before display.
 * These are suggestions for a human coder to review, never final codes.
 */
import type { ChatCompletionRequest } from "./sully";
import type { CodeConfidence, PatientInfo, SuggestedCode } from "./types";

export const M1_MODEL = "sully-m1";

const SYSTEM_PROMPT = `You are a careful certified medical coder. You suggest billing codes for one outpatient clinical note.

Rules:
1. Use only what is written in the note. Never invent diagnoses, symptoms, procedures, or visit details that the note does not state.
2. Suggest ICD-10-CM codes for diagnoses and symptoms that the note assesses or addresses. If the note gives a diagnosis, do not also code its symptoms.
3. Suggest CPT codes only for procedures the note says were performed, plus at most one office or outpatient E/M code (99202-99215) based on the medical decision making the note documents. If the note does not say whether the patient is new or established, use the established patient range and set confidence to "low".
4. Every code needs an "evidence" value: a short quote copied word for word from the note that supports it. If you cannot quote supporting text, leave the code out.
5. Use real, valid codes only. Prefer the most specific code the note supports; if detail is missing, use the unspecified code.
6. Set "confidence" to "high", "medium", or "low".
7. If nothing can be coded, return an empty list.

Reply with JSON only, in exactly this shape:
{"codes":[{"system":"ICD-10-CM","code":"I10","description":"Essential (primary) hypertension","evidence":"quote from the note","confidence":"high"}]}
"system" is either "ICD-10-CM" or "CPT".`;

export function buildCodingRequest(note: string, patient: PatientInfo): ChatCompletionRequest {
  const facts = [
    patient.age !== undefined ? `age ${patient.age}` : null,
    patient.gender ? `gender ${patient.gender}` : null,
  ].filter(Boolean);
  const user = `${facts.length ? `Patient: ${facts.join(", ")}.\n\n` : ""}Clinical note:\n"""\n${note}\n"""`;
  return {
    model: M1_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    // M1 can reason before answering; reasoning tokens count toward the limit,
    // so keep reasoning off and leave room for the JSON answer.
    reasoning_effort: "none",
    max_completion_tokens: 4000,
  };
}

const ICD10 = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
const CPT = /^[0-9]{4}[0-9FTU]$/;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`#>"“”‘’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function words(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9.%/]+/)
    .filter((w) => w.length > 3);
}

/** "exact" if the quote is in the note, "approximate" if most of its words are, otherwise null. */
function matchEvidence(evidence: string, note: string): "exact" | "approximate" | null {
  const e = normalize(evidence);
  if (!e) return null;
  const n = normalize(note);
  if (n.includes(e)) return "exact";
  const ew = words(evidence);
  if (ew.length < 2) return null;
  const nw = new Set(words(note));
  const hits = ew.filter((w) => nw.has(w)).length;
  return hits / ew.length >= 0.8 ? "approximate" : null;
}

/** Parses M1's JSON reply and keeps only well-formed codes backed by a quote from the note. */
export function parseCodingReply(content: string, note: string): { codes: SuggestedCode[]; removed: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Sully M1 did not return valid JSON for the code suggestions.");
  }
  const list = (parsed as { codes?: unknown })?.codes;
  if (!Array.isArray(list)) return { codes: [], removed: 0 };

  const codes: SuggestedCode[] = [];
  let removed = 0;
  const seen = new Set<string>();
  for (const raw of list) {
    const item = raw as Record<string, unknown>;
    const systemRaw = String(item.system ?? "").toUpperCase();
    const system = systemRaw.includes("CPT") ? "CPT" : systemRaw.includes("ICD") ? "ICD-10-CM" : null;
    const code = String(item.code ?? "").trim().toUpperCase();
    const evidence = String(item.evidence ?? "").trim();
    const validCode = system === "CPT" ? CPT.test(code) : system === "ICD-10-CM" ? ICD10.test(code) : false;
    const match = matchEvidence(evidence, note);
    if (!system || !validCode || !match || seen.has(`${system}:${code}`)) {
      removed++;
      continue;
    }
    seen.add(`${system}:${code}`);
    const confidence = String(item.confidence ?? "").toLowerCase();
    codes.push({
      system,
      code,
      description: String(item.description ?? "").trim(),
      evidence,
      confidence: (["high", "medium", "low"].includes(confidence) ? confidence : "low") as CodeConfidence,
      evidenceMatch: match,
    });
  }
  // Diagnoses first, then procedures and visit level.
  codes.sort((a, b) => (a.system === b.system ? 0 : a.system === "ICD-10-CM" ? -1 : 1));
  return { codes, removed };
}
