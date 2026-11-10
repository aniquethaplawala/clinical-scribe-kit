import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** POST /api/auth/logout: clears the session cookie and returns to the login page. */
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
