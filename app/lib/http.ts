/** Small helpers shared by the route handlers. */
import { NextResponse } from "next/server";
import { listEhrs, listTemplates } from "./kit";
import type { ProviderInput } from "./store";
import type { AppError, Credential, PatientInfo } from "./types";

export function errorResponse(error: AppError, status = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const CREDENTIALS: Credential[] = ["MD", "DO", "NP", "PA"];

/** Validates provider fields from the backoffice form. Returns the clean value or an error message. */
export async function parseProviderInput(
  body: Record<string, unknown> | null,
): Promise<{ value: ProviderInput } | { error: string }> {
  if (!body) return { error: "Send the provider as JSON." };
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const credentials = String(body.credentials ?? "") as Credential;
  const specialty = String(body.specialty ?? "").trim();
  const npi = String(body.npi ?? "").trim();
  const defaultTemplateId = String(body.defaultTemplateId ?? "");
  const defaultEhrKey = String(body.defaultEhrKey ?? "");

  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name must be 120 characters or fewer." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!CREDENTIALS.includes(credentials)) return { error: "Credentials must be MD, DO, NP or PA." };
  if (!specialty) return { error: "Specialty is required." };
  if (npi && !/^\d{10}$/.test(npi)) return { error: "NPI must be 10 digits (or leave it empty)." };

  const [templates, ehrs] = await Promise.all([listTemplates(), listEhrs()]);
  if (!templates.some((t) => t.id === defaultTemplateId)) return { error: "Pick a default note template." };
  if (!ehrs.some((e) => e.key === defaultEhrKey)) return { error: "Pick a default EHR." };

  return { value: { name, email, credentials, specialty, npi: npi || undefined, defaultTemplateId, defaultEhrKey } };
}

export function parsePatient(raw: unknown): PatientInfo | { error: string } {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const patient: PatientInfo = {};
  const name = String(p.name ?? "").trim();
  if (name) patient.name = name.slice(0, 200);
  if (p.age !== undefined && p.age !== null && p.age !== "") {
    const age = Number(p.age);
    if (!Number.isInteger(age) || age < 0 || age > 150) return { error: "Patient age must be a whole number from 0 to 150." };
    patient.age = age;
  }
  const gender = String(p.gender ?? "").trim();
  if (gender) patient.gender = gender.slice(0, 50);
  return patient;
}

/** Passwords: at least 8 characters. */
export function parsePassword(raw: unknown): string | { error: string } {
  const password = String(raw ?? "");
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  if (password.length > 200) return { error: "Passwords can be at most 200 characters." };
  return password;
}
