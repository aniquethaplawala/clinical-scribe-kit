import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { errorResponse, parsePatient, readJsonBody } from "@/lib/http";
import { getEhrSummary, isSampleId, listTemplates } from "@/lib/kit";
import { runNote } from "@/lib/pipeline";
import { getProvider, saveVisit, takePendingCalls } from "@/lib/store";
import type { ApiCall, InputMethod, Visit } from "@/lib/types";

const METHODS: InputMethod[] = ["upload", "paste", "live"];

/**
 * POST /api/visits
 * Saves a visit and generates its note (POST /v3/notes). Codes and EHR JSON are
 * started by the results page so each panel can load on its own.
 */
export async function POST(request: Request) {
  const user = await requireApiUser("provider");
  if (user instanceof NextResponse) return user;
  const body = await readJsonBody(request);
  if (!body) return errorResponse({ title: "Check the form", message: "Send the visit as JSON." });

  // Visits always run as the logged-in provider.
  const provider = await getProvider(user.id);
  if (!provider) return errorResponse({ title: "Not allowed", message: "Only providers can run visits." }, 403);

  const templates = await listTemplates();
  const template = templates.find((t) => t.id === body.templateId);
  if (!template) return errorResponse({ title: "Check the form", message: "Pick a note template." });

  const ehr = await getEhrSummary(String(body.ehrKey ?? ""));
  if (!ehr) return errorResponse({ title: "Check the form", message: "Pick a target EHR." });

  const patient = parsePatient(body.patient);
  if ("error" in patient) return errorResponse({ title: "Check the form", message: patient.error });

  const transcript = String(body.transcript ?? "").trim();
  if (!transcript) return errorResponse({ title: "No transcript yet", message: "Add a transcript before generating the note." });
  if (transcript.length > 100_000) {
    return errorResponse({ title: "Transcript too long", message: "Sully accepts transcripts up to 100,000 characters." });
  }

  const inputMethod = METHODS.includes(body.inputMethod as InputMethod) ? (body.inputMethod as InputMethod) : "paste";
  const sampleId = isSampleId(String(body.sampleId ?? "")) ? String(body.sampleId) : undefined;
  const callIds = Array.isArray(body.callIds) ? body.callIds.map(String) : [];
  const calls = await takePendingCalls(callIds, user.id);
  const stream = streamCall(body.stream);
  if (stream) calls.push(stream);

  const visit: Visit = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    demo: isDemoMode(),
    provider: { id: provider.id, name: provider.name, credentials: provider.credentials, specialty: provider.specialty },
    patient,
    templateId: template.id,
    templateName: template.name,
    inputMethod,
    sampleId,
    transcript,
    selectedEhrKey: ehr.key,
    note: { status: "idle" },
    codes: { status: "idle" },
    ehr: {},
    calls,
  };
  await saveVisit(visit);
  const done = await runNote(visit.id);
  return NextResponse.json({ visit: done }, { status: 201 });
}

/** The live WebSocket session, summarized for the API calls panel (the token is never stored). */
function streamCall(raw: unknown): ApiCall | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const durationMs = Number(s.durationMs) || 0;
  const segments = Number(s.finalSegments) || 0;
  const closeCode = Number(s.closeCode) || null;
  const query = "account_id=$SULLY_ACCOUNT_ID&api_token=$STREAMING_TOKEN&sample_rate=16000&encoding=linear16&language=en";
  return {
    id: randomUUID(),
    label: "Live transcription (WebSocket)",
    method: "WS",
    path: "/v1/audio/transcriptions/stream",
    requestHeaders: {},
    requestBody: `Query: ${query.replace(/&/g, "\n       ")}\nMessages sent: {"audio": "<base64 linear16 PCM, 100 ms per chunk>"}`,
    status: closeCode,
    ok: true,
    latencyMs: durationMs,
    note: `Recorded ${(durationMs / 1000).toFixed(1)} s of audio and received ${segments} final transcript segment(s). The browser connected with a short-lived token from POST /v1/audio/transcriptions/stream/token, waited for {"type":"status","status":"connected"}, then sent audio.`,
    curl: `# Open the same socket from a terminal (needs websocat) with a token from the request above\nwebsocat "wss://api.sully.ai/v1/audio/transcriptions/stream?${query}"`,
    demo: false,
    at: typeof s.startedAt === "string" ? s.startedAt : new Date().toISOString(),
  };
}
