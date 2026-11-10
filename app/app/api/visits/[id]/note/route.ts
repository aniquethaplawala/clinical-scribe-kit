import { NextResponse } from "next/server";
import { requireVisitAccess } from "@/lib/auth";
import { isRunning, runNote } from "@/lib/pipeline";

/** POST /api/visits/:id/note: generate the note again (a new, billable request). */
export async function POST(_request: Request, ctx: RouteContext<"/api/visits/[id]/note">) {
  const access = await requireVisitAccess((await ctx.params).id, true);
  if (access instanceof NextResponse) return access;
  const { visit } = access;
  if (isRunning(visit.note)) return NextResponse.json({ visit }, { status: 202 });
  return NextResponse.json({ visit: await runNote(visit.id) });
}
