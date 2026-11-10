/**
 * Signed session cookie. No external auth service.
 *
 * The cookie value is `<base64url payload>.<base64url HMAC-SHA256>`, signed with
 * SESSION_SECRET. The payload only holds the account ID and an expiry; every
 * request still looks the account up, so deleting an account ends its session.
 *
 * Used by proxy.ts (Node runtime) and by pages and routes.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "scribe_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours, in seconds

const holder = globalThis as unknown as { __sessionSecret?: string };

/** SESSION_SECRET from .env.local, or a random dev secret saved in data/ (with a warning). */
function secret(): string {
  if (holder.__sessionSecret) return holder.__sessionSecret;
  const fromEnv = (process.env.SESSION_SECRET ?? "").trim();
  if (fromEnv) return (holder.__sessionSecret = fromEnv);
  const file = path.join(process.cwd(), "data", "session-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  console.warn("[auth] SESSION_SECRET is not set. Using a random dev secret from data/session-secret. Set SESSION_SECRET in .env.local.");
  return (holder.__sessionSecret = readFileSync(file, "utf8").trim());
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(accountId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: accountId, exp: Date.now() + SESSION_MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the account ID if the token is authentic and not expired. */
export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof sub === "string" && typeof exp === "number" && exp > Date.now() ? sub : null;
  } catch {
    return null;
  }
}
