import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse, parsePassword, readJsonBody } from "@/lib/http";
import { getProvider, setPassword } from "@/lib/store";

/** POST /api/providers/:id/password {password}: the admin resets a provider's password. */
export async function POST(request: Request, ctx: RouteContext<"/api/providers/[id]/password">) {
  const user = await requireApiUser("admin");
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  if (!(await getProvider(id))) return errorResponse({ title: "Not found", message: "That provider no longer exists." }, 404);
  const password = parsePassword((await readJsonBody(request))?.password);
  if (typeof password !== "string") return errorResponse({ title: "Check the password", message: password.error });
  await setPassword(id, password);
  return new NextResponse(null, { status: 204 });
}
