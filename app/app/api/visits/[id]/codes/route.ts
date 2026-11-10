import { NextResponse } from "next/server";
import { requireVisitAccess } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { isRunning, runCodes } from "@/lib/pipeline";

/** POST /api/visits/:id/codes: suggest codes from the note with Sully M1. */
export async function POST(_request: Request, ctx: RouteContext<"/api/visits/[id]/codes">) {
  const access = await requireVisitAccess((await ctx.params).id, true);
  if (access instanceof NextResponse) return access;
  const { visit } = access;
  // Never start a second billable request while one is in flight.
  if (isRunning(visit.codes)) return NextResponse.json({ visit }, { status: 202 });
  if (visit.note.status !== "done") return errorResponse({ title: "No note yet", message: "Generate the note first." }, 409);
  return NextResponse.json({ visit: await runCodes(visit.id) });
}
