/**
 * Tiny JSON file store under app/data/ (gitignored). No database to install.
 *
 *   data/accounts.json       the admin and provider logins (hashed passwords)
 *   data/visits/<id>.json    one file per visit
 *   data/calls/<id>.json     API calls made before a visit exists (transcription,
 *                            streaming token); attached to the visit when it is created
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "./config";
import { hashPassword } from "./password";
import type { ApiCall, Provider, ProviderProfile, StoredAccount, User, Visit } from "./types";

const VISITS_DIR = path.join(DATA_DIR, "visits");
const CALLS_DIR = path.join(DATA_DIR, "calls");
const SAFE_ID = /^[a-zA-Z0-9-]+$/;

// One write lock shared by every route in this Node process, so parallel
// requests (codes + EHR JSON) never overwrite each other's changes.
const globalLock = globalThis as unknown as { __scribeLock?: Promise<unknown> };
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalLock.__scribeLock ?? Promise.resolve();
  const next = prev.then(fn, fn);
  globalLock.__scribeLock = next.catch(() => undefined);
  return next;
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}

// ---------- Accounts (admin + providers) ----------

const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const DEFAULT_PASSWORD = "change-me";

/** First run: one admin (from ADMIN_EMAIL / ADMIN_PASSWORD) and one demo provider. */
function seedAccounts(): StoredAccount[] {
  const now = new Date().toISOString();
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase() || "admin@example.com";
  const adminPassword = (process.env.ADMIN_PASSWORD ?? "").trim() || DEFAULT_PASSWORD;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn(`[auth] ADMIN_EMAIL or ADMIN_PASSWORD is not set. Created admin ${adminEmail} with the default password. Change it.`);
  }
  console.warn("[auth] Created demo provider dr.chen@example.com with password change-me. Change or delete it in /admin.");
  return [
    { id: randomUUID(), role: "admin", email: adminEmail, name: "Admin", createdAt: now, passwordHash: hashPassword(adminPassword) },
    {
      id: randomUUID(),
      role: "provider",
      email: "dr.chen@example.com",
      name: "Maya Chen",
      credentials: "MD",
      specialty: "Family Medicine",
      npi: "1234567893",
      defaultTemplateId: "outpatient-soap",
      defaultEhrKey: "epic",
      createdAt: now,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
    },
  ];
}

async function readAccounts(): Promise<StoredAccount[]> {
  const existing = await readJson<StoredAccount[]>(ACCOUNTS_FILE);
  if (existing) return existing;
  return withLock(async () => {
    const again = await readJson<StoredAccount[]>(ACCOUNTS_FILE);
    if (again) return again;
    const seeded = seedAccounts();
    await writeJson(ACCOUNTS_FILE, seeded);
    return seeded;
  });
}

function toUser({ passwordHash: _hash, ...user }: StoredAccount): User {
  void _hash;
  return user;
}

export async function findAccountByEmail(email: string): Promise<StoredAccount | undefined> {
  const e = email.trim().toLowerCase();
  return (await readAccounts()).find((a) => a.email === e);
}

export async function getUser(id: string): Promise<User | undefined> {
  const account = (await readAccounts()).find((a) => a.id === id);
  return account ? toUser(account) : undefined;
}

export async function listProviders(): Promise<Provider[]> {
  return (await readAccounts()).filter((a) => a.role === "provider").map((a) => toUser(a) as Provider);
}

export async function getProvider(id: string): Promise<Provider | undefined> {
  return (await listProviders()).find((p) => p.id === id);
}

export type ProviderInput = ProviderProfile & { name: string; email: string };

export async function createProvider(input: ProviderInput, password: string): Promise<Provider | { error: string }> {
  await readAccounts(); // make sure the seed exists first
  return withLock(async () => {
    const accounts = (await readJson<StoredAccount[]>(ACCOUNTS_FILE)) ?? [];
    if (accounts.some((a) => a.email === input.email)) return { error: "An account with that email already exists." };
    const account: StoredAccount = {
      ...input,
      id: randomUUID(),
      role: "provider",
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };
    await writeJson(ACCOUNTS_FILE, [...accounts, account]);
    return toUser(account) as Provider;
  });
}

export async function updateProvider(id: string, input: ProviderInput): Promise<Provider | { error: string } | undefined> {
  return withLock(async () => {
    const accounts = (await readJson<StoredAccount[]>(ACCOUNTS_FILE)) ?? [];
    const index = accounts.findIndex((a) => a.id === id && a.role === "provider");
    if (index === -1) return undefined;
    if (accounts.some((a) => a.email === input.email && a.id !== id)) return { error: "An account with that email already exists." };
    accounts[index] = { ...accounts[index], ...input };
    await writeJson(ACCOUNTS_FILE, accounts);
    return toUser(accounts[index]) as Provider;
  });
}

export async function setPassword(id: string, password: string): Promise<boolean> {
  return withLock(async () => {
    const accounts = (await readJson<StoredAccount[]>(ACCOUNTS_FILE)) ?? [];
    const account = accounts.find((a) => a.id === id);
    if (!account) return false;
    account.passwordHash = hashPassword(password);
    await writeJson(ACCOUNTS_FILE, accounts);
    return true;
  });
}

/** Removes the provider's login. Their visits stay and show as "former provider". */
export async function deleteProvider(id: string): Promise<boolean> {
  return withLock(async () => {
    const accounts = (await readJson<StoredAccount[]>(ACCOUNTS_FILE)) ?? [];
    const remaining = accounts.filter((a) => !(a.id === id && a.role === "provider"));
    if (remaining.length === accounts.length) return false;
    await writeJson(ACCOUNTS_FILE, remaining);
    return true;
  });
}

// ---------- Visits ----------

function visitFile(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error("Invalid visit id");
  return path.join(VISITS_DIR, `${id}.json`);
}

export async function listVisits(): Promise<Visit[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(VISITS_DIR);
  } catch {
    return [];
  }
  const visits = await Promise.all(
    files.filter((f) => f.endsWith(".json")).map((f) => readJson<Visit>(path.join(VISITS_DIR, f))),
  );
  return visits.filter((v): v is Visit => Boolean(v)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVisit(id: string): Promise<Visit | undefined> {
  if (!SAFE_ID.test(id)) return undefined;
  return readJson<Visit>(visitFile(id));
}

export async function saveVisit(visit: Visit): Promise<void> {
  await withLock(() => writeJson(visitFile(visit.id), visit));
}

/** Read-modify-write under the lock. Returns the updated visit. */
export async function updateVisit(id: string, change: (visit: Visit) => Visit | void): Promise<Visit> {
  return withLock(async () => {
    const visit = await readJson<Visit>(visitFile(id));
    if (!visit) throw new Error("Visit not found");
    const next = change(visit) ?? visit;
    await writeJson(visitFile(id), next);
    return next;
  });
}

export async function deleteVisit(id: string): Promise<void> {
  await withLock(() => fs.rm(visitFile(id), { force: true }));
}

// ---------- API calls made before a visit exists ----------

export async function savePendingCall(call: ApiCall, ownerId: string): Promise<string> {
  await writeJson(path.join(CALLS_DIR, `${call.id}.json`), { ownerId, call });
  return call.id;
}

/** Loads and removes pending calls so they can be attached to a new visit. */
export async function takePendingCalls(ids: string[], ownerId: string): Promise<ApiCall[]> {
  const calls: ApiCall[] = [];
  for (const id of ids) {
    if (!SAFE_ID.test(id)) continue;
    const file = path.join(CALLS_DIR, `${id}.json`);
    const saved = await readJson<{ ownerId: string; call: ApiCall }>(file);
    if (saved && saved.ownerId === ownerId) {
      calls.push(saved.call);
      await fs.rm(file, { force: true });
    }
  }
  return calls.sort((a, b) => a.at.localeCompare(b.at));
}
