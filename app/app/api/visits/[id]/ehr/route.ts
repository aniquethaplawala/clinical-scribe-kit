import { NextResponse } from "next/server";
import { requireVisitAccess } from "@/lib/auth";
import { errorResponse, readJsonBody } from "@/lib/http";
import { getEhrSummary } from "@/lib/kit";
import { isRunning, runEhr } from "@/lib/pipeline";
import { updateVisit } from "@/lib/store";

/** POST /api/visits/:id/ehr {ehrKey, run?}: Text to JSON with that EHR's schema. */
export async function POST(request: Request, ctx: RouteContext<"/api/visits/[id]/ehr">) {
  const access = await requireVisitAccess((await ctx.params).id, true);
  if (access instanceof NextResponse) return access;
  const { visit } = access;
  const body = await readJsonBody(request);
  const ehrKey = String(body?.ehrKey ?? visit.selectedEhrKey);
  if (!(await getEhrSummary(ehrKey))) return errorResponse({ title: "Unknown EHR", message: "Pick one of the listed EHRs." });

  // run: false only switches the selected EHR (no request is sent).
  if (body?.run === false) {
    return NextResponse.json({ visit: await updateVisit(visit.id, (v) => void (v.selectedEhrKey = ehrKey)) });
  }
  if (isRunning(visit.ehr[ehrKey])) return NextResponse.json({ visit }, { status: 202 });
  if (visit.note.status !== "done") return errorResponse({ title: "No note yet", message: "Generate the note first." }, 409);
  return NextResponse.json({ visit: await runEhr(visit.id, ehrKey) });
}
