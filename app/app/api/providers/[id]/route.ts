import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse, parseProviderInput, readJsonBody } from "@/lib/http";
import { deleteProvider, updateProvider } from "@/lib/store";

export async function PUT(request: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const user = await requireApiUser("admin");
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const parsed = await parseProviderInput(await readJsonBody(request));
  if ("error" in parsed) return errorResponse({ title: "Check the form", message: parsed.error });
  const provider = await updateProvider(id, parsed.value);
  if (!provider) return errorResponse({ title: "Not found", message: "That provider no longer exists." }, 404);
  if ("error" in provider) return errorResponse({ title: "Check the form", message: provider.error }, 409);
  return NextResponse.json({ provider });
}

/** DELETE removes the login. The provider's visits are kept. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const user = await requireApiUser("admin");
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  if (!(await deleteProvider(id))) return errorResponse({ title: "Not found", message: "That provider no longer exists." }, 404);
  return new NextResponse(null, { status: 204 });
}
