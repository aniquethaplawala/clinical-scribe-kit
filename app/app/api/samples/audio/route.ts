import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { isSampleId, sampleAudioPath } from "@/lib/kit";

/** GET /api/samples/audio?id=primock57/pm57-d1c01 streams the sample's audio.mp3. */
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  const file = isSampleId(id) ? sampleAudioPath(id) : undefined;
  try {
    if (!file) throw new Error("unknown sample");
    const audio = await fs.readFile(file);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(audio.length) },
    });
  } catch {
    return errorResponse(
      { title: "No audio for this sample", message: "This encounter has no audio.mp3. Run scripts/download_audio.py to fetch all recordings." },
      404,
    );
  }
}
