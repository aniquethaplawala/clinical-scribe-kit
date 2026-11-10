/**
 * Demo mode: simulated Sully responses so the app works end to end without keys.
 *
 * - Transcription returns the sample's human transcript.
 * - Note generation returns the encounter's reference note (reformatted with
 *   ###### headings like Sully's output), or a clear placeholder.
 * - Codes and EHR JSON are deterministic placeholders from simple text parsing.
 *
 * None of this is clinical output. Every screen marks demo data with a badge.
 */
import type { InlineTemplate } from "./sully";
import type { SuggestedCode } from "./types";

// ---------- Notes ----------

/** Reference notes use UPPERCASE headings and "•" bullets; convert to Sully-style Markdown. */
export function formatReferenceNote(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = trimmed.length > 2 && trimmed.length < 60 && /^[A-Z][A-Z0-9 ,&/()'-]+$/.test(trimmed);
    if (isHeading) {
      const title = trimmed
        .toLowerCase()
        .split(" ")
        .map((w) => (["and", "of", "or"].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");
      out.push(`###### ${title}`, "");
    } else {
      out.push(line.replace(/^(\s*)•\s?/, "$1- "));
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** For encounters without a reference note: one placeholder per template section. */
export function placeholderNote(template: InlineTemplate, transcript: string): string {
  const firstPatientLine = transcript
    .split("\n")
    .find((l) => l.startsWith("Patient:"))
    ?.replace(/^Patient:\s*/, "")
    .trim();
  return template.sections
    .map((s, i) => {
      const body =
        i === 0 && firstPatientLine
          ? `- Patient said: "${firstPatientLine.slice(0, 160)}${firstPatientLine.length > 160 ? "..." : ""}"\n\nDemo mode placeholder. Add your Sully keys in .env.local to generate this note from the transcript.`
          : "Demo mode placeholder. Add your Sully keys in .env.local to generate this section.";
      return `###### ${s.title}\n\n${body}`;
    })
    .join("\n\n");
}

// ---------- Codes ----------

type CodeRule = { pattern: RegExp; system: "ICD-10-CM"; code: string; description: string };

/** Small keyword table, only for demo output. Real suggestions come from Sully M1. */
const ICD_RULES: CodeRule[] = [
  { pattern: /congestive heart failure|heart failure/i, system: "ICD-10-CM", code: "I50.9", description: "Heart failure, unspecified" },
  { pattern: /hypertension|high blood pressure/i, system: "ICD-10-CM", code: "I10", description: "Essential (primary) hypertension" },
  { pattern: /depression/i, system: "ICD-10-CM", code: "F32.A", description: "Depression, unspecified" },
  { pattern: /anxiety/i, system: "ICD-10-CM", code: "F41.9", description: "Anxiety disorder, unspecified" },
  { pattern: /mitral regurgitation/i, system: "ICD-10-CM", code: "I34.0", description: "Nonrheumatic mitral (valve) insufficiency" },
  { pattern: /type 2 diabetes|diabetes/i, system: "ICD-10-CM", code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { pattern: /hyperlipidemia|elevated cholesterol|high cholesterol/i, system: "ICD-10-CM", code: "E78.5", description: "Hyperlipidemia, unspecified" },
  { pattern: /hypothyroidism/i, system: "ICD-10-CM", code: "E03.9", description: "Hypothyroidism, unspecified" },
  { pattern: /kidney transplant/i, system: "ICD-10-CM", code: "Z94.0", description: "Kidney transplant status" },
  { pattern: /gastroenteritis/i, system: "ICD-10-CM", code: "K52.9", description: "Noninfective gastroenteritis and colitis, unspecified" },
  { pattern: /diarrh(o)?ea/i, system: "ICD-10-CM", code: "R19.7", description: "Diarrhea, unspecified" },
  { pattern: /asthma/i, system: "ICD-10-CM", code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { pattern: /chest pain|chest discomfort/i, system: "ICD-10-CM", code: "R07.9", description: "Chest pain, unspecified" },
  { pattern: /shortness of breath|dyspnea|trouble breathing/i, system: "ICD-10-CM", code: "R06.02", description: "Shortness of breath" },
  { pattern: /\bcough\b/i, system: "ICD-10-CM", code: "R05.9", description: "Cough, unspecified" },
  { pattern: /nasal congestion/i, system: "ICD-10-CM", code: "R09.81", description: "Nasal congestion" },
  { pattern: /headache/i, system: "ICD-10-CM", code: "R51.9", description: "Headache, unspecified" },
  { pattern: /knee pain/i, system: "ICD-10-CM", code: "M25.569", description: "Pain in unspecified knee" },
  { pattern: /back pain/i, system: "ICD-10-CM", code: "M54.50", description: "Low back pain, unspecified" },
  { pattern: /arthritis/i, system: "ICD-10-CM", code: "M19.90", description: "Unspecified osteoarthritis, unspecified site" },
  { pattern: /edema/i, system: "ICD-10-CM", code: "R60.0", description: "Localized edema" },
  { pattern: /vomiting/i, system: "ICD-10-CM", code: "R11.10", description: "Vomiting, unspecified" },
  { pattern: /fatigue|lethargic/i, system: "ICD-10-CM", code: "R53.83", description: "Other fatigue" },
];

/** The sentence or bullet that contains the match, used as the evidence quote. */
function evidenceFor(note: string, index: number): string {
  const start = Math.max(note.lastIndexOf("\n", index), note.lastIndexOf(". ", index) + 1, 0);
  let end = note.length;
  for (const stop of ["\n", ". "]) {
    const i = note.indexOf(stop, index);
    if (i !== -1 && i < end) end = i + (stop === ". " ? 1 : 0);
  }
  return note
    .slice(start, end)
    .replace(/^[\s\-*#•]+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** First mention that is not negated ("denies chest pain", "no fever"). */
function firstPositiveMatch(pattern: RegExp, text: string): RegExpExecArray | null {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
    const clause = before.split(/[.\n;]/).pop() ?? "";
    if (/\b(denies|denied|no|without|negative for|not)\b/.test(clause)) continue;
    return m as RegExpExecArray;
  }
  return null;
}

export function demoCodes(note: string): SuggestedCode[] {
  const codes: SuggestedCode[] = [];
  const seen = new Set<string>();
  for (const rule of ICD_RULES) {
    const match = firstPositiveMatch(rule.pattern, note);
    if (!match || seen.has(rule.code)) continue;
    seen.add(rule.code);
    codes.push({
      system: rule.system,
      code: rule.code,
      description: rule.description,
      evidence: evidenceFor(note, match.index),
      confidence: "low",
      evidenceMatch: "exact",
    });
    if (codes.length >= 6) break;
  }
  const level = codes.length >= 3 ? "99214" : "99213";
  codes.push({
    system: "CPT",
    code: level,
    description:
      level === "99214"
        ? "Office or other outpatient visit, established patient, moderate medical decision making"
        : "Office or other outpatient visit, established patient, low medical decision making",
    evidence: `${codes.length} problem(s) found in the note (demo rule of thumb, not a real E/M calculation)`,
    confidence: "low",
    evidenceMatch: "approximate",
  });
  return codes;
}

// ---------- EHR JSON ----------

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  description?: string;
  enum?: unknown[];
};

/** Splits a Markdown note into { heading -> body } using ###### (or any #) headings. */
function noteSections(note: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of note.split("\n")) {
    const m = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
      current = { title: m[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
  return sections;
}

const SECTION_HINTS: Array<[RegExp, RegExp]> = [
  // [words in the schema description, matching note headings]
  [/chief complaint/i, /chief complaint|reason for visit/i],
  [/history of present illness|\bhpi\b/i, /history of present illness|\bhpi\b/i],
  [/review of systems/i, /review of systems/i],
  [/physical exam|objective/i, /physical exam|objective|examination/i],
  [/assessment and plan|assessment/i, /assessment|plan/i],
  [/past medical/i, /past medical/i],
  [/allerg/i, /allerg/i],
  [/results|lab/i, /results|lab/i],
  [/vital/i, /vital/i],
];

function sectionFromDescription(note: string, description: string): string | null {
  const sections = noteSections(note);
  for (const [descHint, headingHint] of SECTION_HINTS) {
    if (!descHint.test(description)) continue;
    const found = sections.find((s) => headingHint.test(s.title));
    if (found && found.body && !/^not provided\.?$/i.test(found.body)) return found.body;
  }
  return null;
}

function emptyFor(schema: Schema): unknown {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("null")) return null;
  if (types.includes("array")) return [];
  if (types.includes("object")) return fillObject(schema, () => undefined);
  if (types.includes("boolean")) return false;
  if (types.includes("integer") || types.includes("number")) return 0;
  return "";
}

/** Fills an object schema property by property; `pick` can override any key. */
function fillObject(schema: Schema, pick: (key: string, prop: Schema) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const value = pick(key, prop);
    out[key] = value === undefined ? emptyFor(prop) : value;
  }
  return out;
}

const LAB_WORDS = ["lipid panel", "cbc", "bmp", "cmp", "a1c", "hemoglobin a1c", "tsh", "urinalysis", "stool culture", "metabolic panel"];
const IMAGING_WORDS = ["echocardiogram", "x-ray", "xray", "mri", "ct scan", "ultrasound", "mammogram", "chest x-ray"];

function findTerms(note: string, terms: string[]): string[] {
  const lower = note.toLowerCase();
  const found = terms.filter((t) => new RegExp(`\\b${t.replace(/[-]/g, "\\-")}\\b`).test(lower));
  // Drop terms contained in a longer match ("x-ray" inside "chest x-ray").
  return found
    .filter((t) => !found.some((o) => o !== t && o.includes(t)))
    .map((t) => (t.length <= 4 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1)));
}

function findMedications(note: string) {
  const meds: Array<Record<string, string | null>> = [];
  const re = /\b(?:(increase|initiate|start|continue|stop)\w*\s+(?:her|his|their|the)?\s*)?([A-Za-z][a-z]+)\s+(?:to\s+)?(\d+(?:\.\d+)?\s?(?:mg|mcg|g|units))(?:\s+(once daily|twice daily|daily|at night|as needed))?/gi;
  for (const m of note.matchAll(re)) {
    const verb = (m[1] ?? "").toLowerCase();
    const name = m[2];
    if (["to", "of", "at", "and", "her", "his", "with"].includes(name.toLowerCase())) continue;
    if (meds.some((x) => x.name?.toLowerCase() === name.toLowerCase())) continue;
    meds.push({
      name: name[0].toUpperCase() + name.slice(1),
      dose: m[3],
      route: null,
      frequency: m[4] ?? null,
      duration: null,
      action: verb.startsWith("increase")
        ? "dose-increased"
        : verb.startsWith("initiate") || verb.startsWith("start")
          ? "started"
          : verb.startsWith("stop")
            ? "stopped"
            : "continued",
    });
  }
  return meds;
}

function findVitals(note: string): Record<string, unknown> {
  const bp = /\b(\d{2,3})\s*\/\s*(\d{2,3})\b(?=\s*(?:mm ?hg)?)/i.exec(note);
  const hr = /(?:heart rate|pulse)[^\d\n]{0,20}(\d{2,3})/i.exec(note);
  const rr = /respiratory rate[^\d\n]{0,20}(\d{1,2})/i.exec(note);
  const spo2 = /(?:oxygen saturation|spo2|o2 sat)[^\d\n]{0,20}(\d{2,3})/i.exec(note);
  const temp = /temperature[^\d\n]{0,20}(\d{2,3}(?:\.\d)?)\s*°?\s*([FC])?/i.exec(note);
  return {
    systolicBp: bp ? Number(bp[1]) : null,
    diastolicBp: bp ? Number(bp[2]) : null,
    heartRate: hr ? Number(hr[1]) : null,
    respiratoryRate: rr ? Number(rr[1]) : null,
    temperature: { value: temp ? Number(temp[1]) : null, unit: temp ? (temp[2] ?? null) : null },
    oxygenSaturation: spo2 ? Number(spo2[1]) : null,
    weight: { value: null, unit: null },
    height: { value: null, unit: null },
    painScore: null,
  };
}

/** Builds placeholder JSON that matches the EHR's schema, using simple parsing of the note. */
export function demoEhrData(note: string, schema: Schema): Record<string, unknown> {
  const codes = demoCodes(note).filter((c) => c.system === "ICD-10-CM");
  return fillObject(schema, (key, prop) => {
    switch (key) {
      case "ehrNote":
      case "sections":
        return fillObject(prop, (_k, sub) => {
          const desc = sub.description ?? "";
          if (/entire note/i.test(desc)) return note;
          return sectionFromDescription(note, desc);
        });
      case "problems":
        return codes.map((c) => ({
          name: c.description.replace(/, unspecified$/i, ""),
          icd10Code: null, // the schemas only return a code when the note states one
          status: "assessed-today",
          assessment: null,
        }));
      case "medications":
        return findMedications(note);
      case "allergies":
        return [];
      case "noKnownAllergies":
        return /no known (drug )?allergies|nkda/i.test(note) ? true : null;
      case "vitals":
        return fillObject(prop, (k) => findVitals(note)[k]);
      case "orders":
        return { labs: findTerms(note, LAB_WORDS), imaging: findTerms(note, IMAGING_WORDS), referrals: [] };
      case "followUp": {
        const m = /(?:follow[- ]?up|review|return)\s+(?:in\s+)?(\d+\s*(?:-\s*\d+\s*)?(?:d|days?|weeks?|months?))/i.exec(note);
        return m ? m[0] : null;
      }
      case "patientInstructions":
        return note
          .split("\n")
          .filter((l) => /encourag|advis|recommend|counsel/i.test(l))
          .map((l) => l.replace(/^[\s\-*•]+/, "").replace(/\*\*/g, "").trim())
          .slice(0, 5);
      default:
        return undefined;
    }
  });
}
