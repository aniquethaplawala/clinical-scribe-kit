import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { findAccountByEmail } from "@/lib/store";

/** POST /api/auth/login {email, password}: sets the signed, httpOnly session cookie. */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");
  const account = email ? await findAccountByEmail(email) : undefined;
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return errorResponse({ title: "Could not log in", message: "The email or password is not right." }, 401);
  }
  const res = NextResponse.json({ role: account.role });
  res.cookies.set(SESSION_COOKIE, createSessionToken(account.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
