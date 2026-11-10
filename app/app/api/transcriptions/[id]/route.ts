import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { isSampleId, loadSampleTranscript } from "@/lib/kit";
import { savePendingCall } from "@/lib/store";
import { getTranscription, SullyError, type Transcription } from "@/lib/sully";

const DEMO_PROCESSING_MS = 2_500;

/** Demo IDs look like demo_<base64url sample id>_<created ms>. */
async function demoTranscription(id: string): Promise<Transcription> {
  const [, encoded, created] = id.split("_");
  const sampleId = Buffer.from(encoded ?? "", "base64url").toString("utf8");
  if (Date.now() - Number(created) < DEMO_PROCESSING_MS) return { id, status: "processing" };
  const transcript = isSampleId(sampleId) ? await loadSampleTranscript(sampleId) : undefined;
  return {
    id,
    status: "completed",
    result: { channels: [{ transcript: transcript ?? "Demo transcript not found.", confidence: 1 }] },
  };
}

type Channel = NonNullable<NonNullable<Transcription["result"]>["channels"]>[number];

/**
 * Sully tags each word with a `speaker` number when it can tell voices apart.
 * Group consecutive words by speaker into "Speaker 1: ..." lines so note
 * generation can tell who said what. Falls back to the plain channel text.
 */
function channelText(c: Channel): string {
  const words = c.words ?? [];
  if (!words.length || new Set(words.map((w) => w.speaker)).size < 2) return c.transcript.trim();
  const order: number[] = [];
  const lines: string[] = [];
  let current: number | undefined;
  for (const w of words) {
    const spk = w.speaker ?? 0;
    if (!order.includes(spk)) order.push(spk);
    const token = w.punctuated_word ?? w.word;
    if (spk !== current) {
      lines.push(`Speaker ${order.indexOf(spk) + 1}: ${token}`);
      current = spk;
    } else {
      lines[lines.length - 1] += ` ${token}`;
    }
  }
  return lines.join("\n");
}

/**
 * GET /api/transcriptions/:id?poll=N
 * Polls Sully's GET /v2/audio/transcriptions/:id. Only the final poll is logged in the API calls panel.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/transcriptions/[id]">) {
  const user = await requireApiUser("provider");
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  if (!/^[\w.-]+$/.test(id)) return errorResponse({ title: "Invalid ID", message: "Unknown transcription ID." });
  const polls = Number(new URL(request.url).searchParams.get("poll") ?? "1");
  const demoData = id.startsWith("demo_") ? await demoTranscription(id) : undefined;

  try {
    const { data, call } = await getTranscription(id, demoData ? () => ({ data: demoData }) : undefined);
    const tx = data.data;
    if (tx.status !== "completed" && tx.status !== "failed") {
      return NextResponse.json({ id: tx.id, status: tx.status });
    }
    const callId = await savePendingCall({ ...call, note: [call.note, `Final status after ${polls} status check(s).`].filter(Boolean).join(" ") }, user.id);
    if (tx.status === "failed") {
      return NextResponse.json(
        { id: tx.id, status: tx.status, callId, error: { title: "Transcription failed", message: tx.result?.error ?? "Sully could not transcribe this audio." } },
        { status: 422 },
      );
    }
    const transcript = (tx.result?.channels ?? []).map(channelText).filter(Boolean).join("\n\n");
    const sampleId = demoData ? Buffer.from(id.split("_")[1] ?? "", "base64url").toString("utf8") : undefined;
    return NextResponse.json({ id: tx.id, status: tx.status, transcript, callId, sampleId });
  } catch (err) {
    if (err instanceof SullyError) {
      const callId = await savePendingCall(err.call, user.id);
      return NextResponse.json({ error: err.appError, callId }, { status: err.appError.status ?? 502 });
    }
    throw err;
  }
}
