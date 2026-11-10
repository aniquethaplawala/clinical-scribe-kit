import { NextResponse } from "next/server";
import { requireVisitAccess } from "@/lib/auth";
import { deleteVisit } from "@/lib/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/visits/[id]">) {
  const access = await requireVisitAccess((await ctx.params).id);
  if (access instanceof NextResponse) return access;
  return NextResponse.json({ visit: access.visit });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/visits/[id]">) {
  const access = await requireVisitAccess((await ctx.params).id, true);
  if (access instanceof NextResponse) return access;
  await deleteVisit(access.visit.id);
  return new NextResponse(null, { status: 204 });
}
