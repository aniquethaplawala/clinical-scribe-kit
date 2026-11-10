import path from "node:path";

/** The clinical-scribe-kit repo root (this app lives in its `app/` folder). */
export const KIT_ROOT = path.resolve(process.cwd(), "..");

/** Local JSON store for providers, visits and API call logs (gitignored). */
export const DATA_DIR = path.join(process.cwd(), "data");

export type SullyConfig = {
  accountId: string;
  apiKey: string;
  baseUrl: string;
  demo: boolean;
};

/** Reads Sully settings from .env.local. Without an API key the app runs in demo mode. */
export function getSullyConfig(): SullyConfig {
  const apiKey = (process.env.SULLY_API_KEY ?? "").trim();
  const accountId = (process.env.SULLY_ACCOUNT_ID ?? "").trim();
  const baseUrl = ((process.env.SULLY_API_BASE_URL ?? "").trim() || "https://api.sully.ai").replace(/\/+$/, "");
  return { accountId, apiKey, baseUrl, demo: apiKey === "" };
}

export function isDemoMode(): boolean {
  return getSullyConfig().demo;
}
