// Shared types used by the server and the browser.

export type Credential = "MD" | "DO" | "NP" | "PA";

export type Role = "admin" | "provider";

export type ProviderProfile = {
  credentials: Credential;
  specialty: string;
  npi?: string;
  defaultTemplateId: string;
  defaultEhrKey: string;
};

/** A logged-in account as the app sees it (never includes the password hash). */
export type User = {
  id: string;
  role: Role;
  email: string;
  name: string;
  createdAt: string;
} & Partial<ProviderProfile>;

/** A provider account: a user with a clinical profile. */
export type Provider = User & ProviderProfile & { role: "provider" };

/** What is saved in data/accounts.json. */
export type StoredAccount = User & { passwordHash: string };

export type TemplateSummary = {
  id: string; // path inside templates/ without .json, e.g. "specialty/cardiology"
  name: string;
  description: string;
  sectionCount: number;
};

export type EhrSummary = {
  key: string;
  name: string;
  verdict: string; // e.g. "Epic: Yes, with standard FHIR."
  writableResources: string[];
};

export type SampleSummary = {
  id: string; // e.g. "primock57/pm57-d1c01"
  label: string;
  source: string;
  hasAudio: boolean;
  hasReferenceNote: boolean;
  patient?: { age?: number; gender?: string };
};

export type InputMethod = "upload" | "paste" | "live";

export type PatientInfo = {
  name?: string;
  age?: number;
  gender?: string;
};

/** A friendly error that is safe to show in the UI. */
export type AppError = {
  title: string;
  message: string;
  status?: number | null;
  code?: string;
  requestId?: string;
};

/** One request made to Sully, recorded for the developer panel. */
export type ApiCall = {
  id: string;
  label: string;
  method: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody?: string; // truncated for display
  status: number | null;
  ok: boolean;
  latencyMs: number;
  requestId?: string;
  responsePreview?: string;
  error?: string;
  curl: string;
  demo: boolean;
  note?: string;
  at: string;
};

export type StepStatus = "idle" | "running" | "done" | "error";

export type Step<T> = {
  status: StepStatus;
  startedAt?: string;
  result?: T;
  error?: AppError;
};

export type CodeConfidence = "high" | "medium" | "low";

export type SuggestedCode = {
  system: "ICD-10-CM" | "CPT";
  code: string;
  description: string;
  evidence: string;
  confidence: CodeConfidence;
  evidenceMatch: "exact" | "approximate";
};

export type NoteResult = { note: string; requestId?: string };
export type CodesResult = { codes: SuggestedCode[]; removed: number };
export type EhrResult = {
  ehrKey: string;
  data: unknown;
};

export type Visit = {
  id: string;
  createdAt: string;
  demo: boolean;
  provider: Pick<Provider, "id" | "name" | "credentials" | "specialty">;
  patient: PatientInfo;
  templateId: string;
  templateName: string;
  inputMethod: InputMethod;
  sampleId?: string;
  transcript: string;
  selectedEhrKey: string;
  note: Step<NoteResult>;
  codes: Step<CodesResult>;
  ehr: Record<string, Step<EhrResult>>;
  calls: ApiCall[];
};
