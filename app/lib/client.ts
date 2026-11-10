/** Browser-side helper for calling this app's own routes. Throws an AppError on failure. */
import type { AppError } from "./types";

export class ClientError extends Error {
  appError: AppError;
  body: Record<string, unknown>;
  constructor(appError: AppError, body: Record<string, unknown>) {
    super(appError.message);
    this.appError = appError;
    this.body = body;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ClientError({ title: "Network error", message: "Could not reach the app server. Is `npm run dev` still running?" }, {});
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || body.error) {
    const appError = (body.error as AppError) ?? { title: `Request failed (${res.status})`, message: "Unexpected server error." };
    throw new ClientError(appError, body);
  }
  return body as T;
}

export function asAppError(err: unknown): AppError {
  if (err instanceof ClientError) return err.appError;
  return { title: "Something went wrong", message: err instanceof Error ? err.message : String(err) };
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
