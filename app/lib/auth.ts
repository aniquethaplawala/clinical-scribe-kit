/**
 * Who is logged in, and what they may do.
 *   admin:    manages provider accounts, sees every visit (read-only)
 *   provider: runs visits and sees only their own
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "./session";
import { getUser, getVisit } from "./store";
import type { Role, User, Visit } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  const id = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return id ? ((await getUser(id)) ?? null) : null;
}

/** For pages: redirect to /login (or home) unless the user has the role. */
export async function requirePageUser(role?: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/");
  return user;
}

/** For API routes: returns the user, or a 401/403 response to send back. */
export async function requireApiUser(role?: Role): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { title: "Please log in", message: "Your session has ended. Log in again." } }, { status: 401 });
  }
  if (role && user.role !== role) {
    return NextResponse.json(
      { error: { title: "Not allowed", message: role === "admin" ? "Only the admin can do this." : "Only providers can run visits." } },
      { status: 403 },
    );
  }
  return user;
}

export function canView(user: User, visit: Visit): boolean {
  return user.role === "admin" || visit.provider.id === user.id;
}

/**
 * Loads a visit for an API route. Someone else's visit is reported as not found.
 * With `write`, only the provider who owns the visit may continue (the admin is read-only).
 */
export async function requireVisitAccess(id: string, write = false): Promise<{ user: User; visit: Visit } | NextResponse> {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const visit = await getVisit(id);
  if (!visit || !canView(user, visit)) {
    return NextResponse.json({ error: { title: "Not found", message: "That visit does not exist." } }, { status: 404 });
  }
  if (write && visit.provider.id !== user.id) {
    return NextResponse.json({ error: { title: "Read only", message: "Only the provider who ran this visit can change it." } }, { status: 403 });
  }
  return { user, visit };
}
