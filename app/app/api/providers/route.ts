import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { errorResponse, parsePassword, parseProviderInput, readJsonBody } from "@/lib/http";
import { createProvider, listProviders } from "@/lib/store";

export async function GET() {
  const user = await requireApiUser("admin");
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ providers: await listProviders() });
}

/** POST /api/providers: create a provider account (admin only). */
export async function POST(request: Request) {
  const user = await requireApiUser("admin");
  if (user instanceof NextResponse) return user;
  const body = await readJsonBody(request);
  const parsed = await parseProviderInput(body);
  if ("error" in parsed) return errorResponse({ title: "Check the form", message: parsed.error });
  const password = parsePassword(body?.password);
  if (typeof password !== "string") return errorResponse({ title: "Check the form", message: password.error });
  const provider = await createProvider(parsed.value, password);
  if ("error" in provider) return errorResponse({ title: "Check the form", message: provider.error }, 409);
  return NextResponse.json({ provider }, { status: 201 });
}
