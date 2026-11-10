import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { isSampleId } from "@/lib/kit";
import { savePendingCall } from "@/lib/store";
import { createTranscription, SullyError } from "@/lib/sully";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MiB, from the transcription docs
const DEFAULT_DEMO_SAMPLE = "primock57/pm57-d1c01";

/**
 * POST /api/transcriptions (multipart: audio, optional sampleId)
 * Forwards the file to Sully's POST /v2/audio/transcriptions and returns the transcription ID.
 */
export async function POST(request: Request) {
  const user = await requireApiUser("provider");
  if (user instanceof NextResponse) return user;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse({ title: "Upload failed", message: "Send the audio as multipart form data." });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return errorResponse({ title: "No audio file", message: "Choose an audio file to upload." });
  }
  if (audio.size > MAX_BYTES) {
    return errorResponse({ title: "File too large", message: "Audio files can be at most 100 MiB." }, 413);
  }
  const requested = String(form.get("sampleId") ?? "");
  // In demo mode, uploads of your own audio fall back to a sample transcript.
  const demoSample = isSampleId(requested) ? requested : DEFAULT_DEMO_SAMPLE;

  try {
    const { data, call } = await createTranscription(
      { audio, filename: audio.name || "audio.mp3", language: "en" },
      () => ({
        data: {
          id: `demo_${Buffer.from(demoSample).toString("base64url")}_${Date.now()}`,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    );
    const callId = await savePendingCall(call, user.id);
    return NextResponse.json({ id: data.data.id, status: data.data.status, callId, demo: call.demo }, { status: 201 });
  } catch (err) {
    if (err instanceof SullyError) {
      const callId = await savePendingCall(err.call, user.id);
      return NextResponse.json({ error: err.appError, callId }, { status: err.appError.status ?? 502 });
    }
    throw err;
  }
}
