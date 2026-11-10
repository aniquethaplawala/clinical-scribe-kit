/**
 * Typed Sully API client: one function per endpoint.
 *
 * - Runs on the server only. API keys never reach the browser.
 * - Uses plain fetch so every request maps 1:1 to the curl in the Sully docs.
 * - No automatic retries: notes, transcriptions, Text to JSON and M1 calls are
 *   billable, and repeating a POST can create duplicate work.
 * - Every call is recorded as an ApiCall (redacted headers, truncated body,
 *   status, latency, request ID, curl) for the developer panel.
 * - In demo mode (no SULLY_API_KEY) the request is built exactly the same way
 *   but not sent; the caller supplies a simulated response.
 */
import { randomUUID } from "node:crypto";
import { getSullyConfig } from "./config";
import { describeSullyError } from "./errors";
import type { ApiCall, AppError } from "./types";

// ---------- Response types (from the Sully docs) ----------

export type TranscriptionStatus = "pending" | "processing" | "completed" | "failed";

export type Transcription = {
  id: string;
  status: TranscriptionStatus;
  result?: {
    channels?: Array<{
      transcript: string;
      confidence?: number;
      /** Optional per-word detail; `speaker` is present when Sully separates voices. */
      words?: Array<{ word: string; punctuated_word?: string; start?: number; end?: number; speaker?: number }>;
    }>;
    error?: string;
  };
  created_at?: string;
  updated_at?: string;
};

export type InlineTemplate = {
  instructions?: string;
  sections: Array<{ title: string; instructions: string }>;
};

export type ClinicalContext = {
  patient?: { name?: string; age?: number; gender?: string };
  medications?: Array<{ name: string; description: string }>;
  pastVisits?: Array<{ date: string; content: string }>;
  contextItems?: Array<{ label: string; content: string }>;
};

export type GenerateNoteResponse = {
  requestId: string;
  note: string;
  usage?: { inputTokens: number; outputTokens: number };
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  response_format?: { type: "json_object" | "text" };
  max_completion_tokens?: number;
  temperature?: number;
  reasoning_effort?: "none" | "medium" | "high";
};

export type ChatCompletionResponse = {
  id: string;
  model: string;
  choices: Array<{ index: number; message: { role: string; content: string | null }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export type SullyResult<T> = { data: T; call: ApiCall };

/** Thrown for any failed Sully request. Carries a UI-safe message and the recorded call. */
export class SullyError extends Error {
  appError: AppError;
  call: ApiCall;
  constructor(appError: AppError, call: ApiCall) {
    super(appError.message);
    this.appError = appError;
    this.call = call;
  }
}

// ---------- Endpoints ----------

const FIVE_MINUTES = 300_000;

/** POST /v2/audio/transcriptions: upload a finished recording (multipart, field `audio`). */
export function createTranscription(
  input: { audio: Blob; filename: string; language?: string },
  demo?: () => { data: Transcription },
): Promise<SullyResult<{ data: Transcription }>> {
  return send(
    {
      label: "Upload audio for transcription",
      method: "POST",
      path: "/v2/audio/transcriptions",
      form: {
        file: { field: "audio", blob: input.audio, filename: input.filename },
        fields: { language: input.language ?? "en", multichannel: "false", dictation: "false" },
      },
      timeoutMs: FIVE_MINUTES,
    },
    demo,
  );
}

/** GET /v2/audio/transcriptions/{id}: poll until `completed` or `failed`. */
export function getTranscription(
  id: string,
  demo?: () => { data: Transcription },
): Promise<SullyResult<{ data: Transcription }>> {
  return send(
    {
      label: "Check transcription status",
      method: "GET",
      path: `/v2/audio/transcriptions/${encodeURIComponent(id)}`,
      timeoutMs: 30_000,
    },
    demo,
  );
}

/** POST /v1/audio/transcriptions/stream/token: short-lived token for a browser WebSocket. */
export function createStreamingToken(expiresIn = 300): Promise<SullyResult<{ data: { token: string } }>> {
  return send({
    label: "Create streaming token",
    method: "POST",
    path: "/v1/audio/transcriptions/stream/token",
    json: { expiresIn },
    timeoutMs: 30_000,
    redactResponse: (text) => text.replace(/("token"\s*:\s*")[^"]+(")/g, "$1[redacted]$2"),
  });
}

/** POST /v3/notes: transcript + inline template (+ optional clinical context) to a note. */
export function generateNote(
  body: { transcript: string; template: InlineTemplate; clinicalContext?: ClinicalContext },
  demo?: () => GenerateNoteResponse,
): Promise<SullyResult<GenerateNoteResponse>> {
  return send(
    { label: "Generate note", method: "POST", path: "/v3/notes", json: body, timeoutMs: FIVE_MINUTES },
    demo,
  );
}

/** POST /v1/utils/text-to-json: text + JSON Schema to schema-validated `data`. */
export function textToJson<T = unknown>(
  body: { text: string; schema: object },
  demo?: () => { data: T },
): Promise<SullyResult<{ data: T }>> {
  return send(
    {
      label: "Text to JSON (EHR schema)",
      method: "POST",
      path: "/v1/utils/text-to-json",
      json: body,
      timeoutMs: FIVE_MINUTES,
    },
    demo,
  );
}

/** POST /openai/v1/chat/completions: Sully M1, OpenAI-compatible. */
export function m1ChatCompletion(
  body: ChatCompletionRequest,
  label: string,
  demo?: () => ChatCompletionResponse,
): Promise<SullyResult<ChatCompletionResponse>> {
  return send(
    { label, method: "POST", path: "/openai/v1/chat/completions", json: body, timeoutMs: FIVE_MINUTES },
    demo,
  );
}

// ---------- Request plumbing ----------

type RequestSpec = {
  label: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  json?: unknown;
  form?: {
    file: { field: string; blob: Blob; filename: string };
    fields: Record<string, string>;
  };
  timeoutMs: number;
  redactResponse?: (text: string) => string;
};

const BODY_PREVIEW_LIMIT = 1_500;
const RESPONSE_PREVIEW_LIMIT = 2_000;

async function send<T>(spec: RequestSpec, demo?: () => T): Promise<SullyResult<T>> {
  const config = getSullyConfig();
  const started = Date.now();
  const base: Omit<ApiCall, "status" | "ok" | "latencyMs"> = {
    id: randomUUID(),
    label: spec.label,
    method: spec.method,
    path: spec.path,
    requestHeaders: redactedHeaders(spec, config.accountId),
    requestBody: bodyPreview(spec),
    curl: toCurl(spec),
    demo: config.demo,
    at: new Date().toISOString(),
  };

  if (config.demo) {
    if (!demo) {
      const appError: AppError = {
        title: "Needs your Sully keys",
        message: "This feature needs a real Sully API key. Add SULLY_ACCOUNT_ID and SULLY_API_KEY to .env.local.",
      };
      throw new SullyError(appError, { ...base, status: null, ok: false, latencyMs: 0, error: appError.message });
    }
    const data = demo();
    const call: ApiCall = {
      ...base,
      status: 200,
      ok: true,
      latencyMs: Date.now() - started,
      requestId: `demo_${base.id.slice(0, 8)}`,
      responsePreview: truncate(JSON.stringify(data, null, 2), RESPONSE_PREVIEW_LIMIT),
      note: "Demo mode: this request was not sent. The response is simulated.",
    };
    return { data, call };
  }

  if (!config.accountId) {
    const appError: AppError = {
      title: "Missing account ID",
      message: "SULLY_API_KEY is set but SULLY_ACCOUNT_ID is empty. Add it to .env.local and restart the dev server.",
    };
    throw new SullyError(appError, { ...base, status: null, ok: false, latencyMs: 0, error: appError.message });
  }

  const headers: Record<string, string> = {
    "X-Account-Id": config.accountId,
    "X-Api-Key": config.apiKey,
  };
  let body: BodyInit | undefined;
  if (spec.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(spec.json);
  } else if (spec.form) {
    // Let fetch set the multipart boundary.
    const form = new FormData();
    form.append(spec.form.file.field, spec.form.file.blob, spec.form.file.filename);
    for (const [k, v] of Object.entries(spec.form.fields)) form.append(k, v);
    body = form;
  }

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${spec.path}`, {
      method: spec.method,
      headers,
      body,
      signal: AbortSignal.timeout(spec.timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const appError = describeSullyError({ status: null, message });
    throw new SullyError(appError, {
      ...base,
      status: null,
      ok: false,
      latencyMs: Date.now() - started,
      error: message,
    });
  }

  const text = await res.text();
  const parsed = safeJson(text);
  const requestId =
    res.headers.get("x-request-id") ?? (isRecord(parsed) && typeof parsed.requestId === "string" ? parsed.requestId : undefined);
  const preview = truncate(spec.redactResponse ? spec.redactResponse(text) : prettyIfJson(text, parsed), RESPONSE_PREVIEW_LIMIT);
  const call: ApiCall = {
    ...base,
    status: res.status,
    ok: res.ok,
    latencyMs: Date.now() - started,
    requestId,
    responsePreview: preview,
  };

  if (!res.ok) {
    const { code, message } = readErrorBody(parsed, text);
    const appError = describeSullyError({ status: res.status, code, message, requestId });
    throw new SullyError(appError, { ...call, error: message ?? `HTTP ${res.status}` });
  }
  if (parsed === undefined) {
    const appError: AppError = {
      title: "Unexpected response",
      message: "Sully returned a response that is not JSON.",
      status: res.status,
      requestId,
    };
    throw new SullyError(appError, { ...call, ok: false, error: appError.message });
  }
  return { data: parsed as T, call };
}

/** Error bodies differ by endpoint: {code,message}, {error,message}, or OpenAI's {error:{code,message}}. */
function readErrorBody(parsed: unknown, text: string): { code?: string; message?: string } {
  if (!isRecord(parsed)) return { message: text ? truncate(text, 300) : undefined };
  const err = parsed.error;
  if (isRecord(err)) {
    return { code: str(err.code) ?? str(err.type), message: str(err.message) };
  }
  return {
    code: str(parsed.code) ?? (typeof err === "string" ? err : undefined),
    message: str(parsed.message) ?? (typeof err === "string" ? err : undefined),
  };
}

function redactedHeaders(spec: RequestSpec, accountId: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Account-Id": accountId ? `${"*".repeat(Math.max(0, accountId.length - 4))}${accountId.slice(-4)}` : "(not set)",
    "X-Api-Key": "[redacted]",
  };
  if (spec.json !== undefined) headers["Content-Type"] = "application/json";
  if (spec.form) headers["Content-Type"] = "multipart/form-data";
  return headers;
}

function bodyPreview(spec: RequestSpec): string | undefined {
  if (spec.json !== undefined) return truncate(JSON.stringify(spec.json, null, 2), BODY_PREVIEW_LIMIT);
  if (spec.form) {
    const { file, fields } = spec.form;
    const lines = [`${file.field}=@${file.filename} (${formatBytes(file.blob.size)}, ${file.blob.type || "audio"})`];
    for (const [k, v] of Object.entries(fields)) lines.push(`${k}=${v}`);
    return lines.join("\n");
  }
  return undefined;
}

/** A curl command a developer can paste into a terminal (uses env vars, never the real key). */
function toCurl(spec: RequestSpec): string {
  const lines = [`curl "$SULLY_API_BASE_URL${spec.path}"`];
  if (spec.method !== "GET") lines.push(`  --request ${spec.method}`);
  lines.push(`  --header "X-Account-Id: $SULLY_ACCOUNT_ID"`, `  --header "X-Api-Key: $SULLY_API_KEY"`);
  if (spec.form) {
    lines.push(`  --form "${spec.form.file.field}=@./${spec.form.file.filename}"`);
    for (const [k, v] of Object.entries(spec.form.fields)) lines.push(`  --form "${k}=${v}"`);
  }
  if (spec.json !== undefined) {
    lines.push(`  --header "Content-Type: application/json"`);
    lines.push(`  --data @- <<'JSON'`);
    return `${lines.join(" \\\n")}\n${JSON.stringify(spec.json, null, 2)}\nJSON`;
  }
  return lines.join(" \\\n");
}

// ---------- small helpers ----------

function safeJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function prettyIfJson(text: string, parsed: unknown): string {
  return parsed === undefined ? text : JSON.stringify(parsed, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n... (${s.length - max} more characters)` : s;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
