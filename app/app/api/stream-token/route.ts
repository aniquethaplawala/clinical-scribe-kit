import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getSullyConfig } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { savePendingCall } from "@/lib/store";
import { createStreamingToken, SullyError } from "@/lib/sully";

const EXPIRES_IN = 300; // seconds; the token is only needed to open the socket

/**
 * POST /api/stream-token
 * Creates a short-lived streaming token on the server and returns the WebSocket URL
 * for the browser. The permanent API key never leaves the server.
 */
export async function POST() {
  const user = await requireApiUser("provider");
  if (user instanceof NextResponse) return user;
  const config = getSullyConfig();
  if (config.demo) {
    return errorResponse(
      {
        title: "Live transcription needs your Sully keys",
        message: "Demo mode cannot stream audio. Add SULLY_ACCOUNT_ID and SULLY_API_KEY to .env.local, restart the dev server, or use Upload audio or Paste transcript instead.",
      },
      400,
    );
  }
  try {
    const { data, call } = await createStreamingToken(EXPIRES_IN);
    const callId = await savePendingCall(call, user.id);
    const url = new URL("/v1/audio/transcriptions/stream", config.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("account_id", config.accountId);
    url.searchParams.set("api_token", data.data.token);
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("language", "en");
    return NextResponse.json({ url: url.toString(), callId, expiresIn: EXPIRES_IN });
  } catch (err) {
    if (err instanceof SullyError) {
      const callId = await savePendingCall(err.call, user.id);
      return NextResponse.json({ error: err.appError, callId }, { status: err.appError.status ?? 502 });
    }
    throw err;
  }
}
