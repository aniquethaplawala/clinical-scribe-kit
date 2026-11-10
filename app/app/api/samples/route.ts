import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { isSampleId, loadSampleTranscript } from "@/lib/kit";

/** GET /api/samples?id=primock57/pm57-d1c01 returns the sample's human transcript. */
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  const transcript = isSampleId(id) ? await loadSampleTranscript(id) : undefined;
  if (!transcript) return errorResponse({ title: "Sample not found", message: "Pick one of the listed samples." }, 404);
  return NextResponse.json({ id, transcript });
}
