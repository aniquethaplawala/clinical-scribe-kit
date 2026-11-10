import type { InputMethod, PatientInfo } from "./types";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function patientLabel(p: PatientInfo): string {
  const parts = [p.age !== undefined ? `${p.age} y` : null, p.gender || null].filter(Boolean);
  const name = p.name || "Unnamed patient";
  return parts.length ? `${name}, ${parts.join(", ")}` : name;
}

export const INPUT_LABELS: Record<InputMethod, string> = {
  upload: "Audio upload",
  paste: "Transcript",
  live: "Live conversation",
};
