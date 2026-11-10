"use client";

import { Braces, FileText, LoaderCircle, MessageSquareText, Tags, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { api, asAppError, postJson } from "@/lib/client";
import { formatDate, INPUT_LABELS, patientLabel } from "@/lib/format";
import type { AppError, EhrSummary, StepStatus, Visit } from "@/lib/types";
import { ApiCallsPanel } from "./ApiCallsPanel";
import { CodesPanel } from "./CodesPanel";
import { EhrPanel } from "./EhrPanel";
import { NotePanel } from "./NotePanel";
import { TranscriptPanel } from "./TranscriptPanel";

type Tab = "note" | "transcript" | "codes" | "ehr";
type VisitResponse = { visit: Visit };

/**
 * Results for one visit. `readOnly` (the admin, or a former provider's visit) shows
 * saved results without starting or changing anything.
 */
export function VisitView({
  initialVisit,
  ehrs,
  readOnly,
  formerProvider,
}: {
  initialVisit: Visit;
  ehrs: EhrSummary[];
  readOnly: boolean;
  formerProvider: boolean;
}) {
  const router = useRouter();
  const [visit, setVisit] = useState(initialVisit);
  const [tab, setTab] = useState<Tab>("note");
  const [actionError, setActionError] = useState<AppError | null>(null);
  const started = useRef(new Set<string>());

  const ehrStep = visit.ehr[visit.selectedEhrKey] ?? { status: "idle" as StepStatus };
  const anyRunning =
    visit.note.status === "running" || visit.codes.status === "running" || Object.values(visit.ehr).some((s) => s.status === "running");

  /** Starts a pipeline step once. The server also refuses duplicates while a step is running. */
  const requestStep = useCallback(async (key: string, url: string, body: unknown = {}): Promise<Visit | null> => {
    if (started.current.has(key)) return null;
    started.current.add(key);
    try {
      return (await postJson<VisitResponse>(url, body)).visit;
    } finally {
      started.current.delete(key);
    }
  }, []);

  const runStep = useCallback(
    (key: string, url: string, body: unknown = {}) =>
      requestStep(key, url, body).then(
        (next) => next && setVisit(next),
        (err) => setActionError(asAppError(err)),
      ),
    [requestStep],
  );

  // Once the note exists, fetch codes and EHR JSON in parallel.
  useEffect(() => {
    if (readOnly || visit.note.status !== "done") return;
    if (visit.codes.status === "idle") void runStep("codes", `/api/visits/${visit.id}/codes`);
    if (!visit.ehr[visit.selectedEhrKey]) {
      void runStep(`ehr:${visit.selectedEhrKey}`, `/api/visits/${visit.id}/ehr`, { ehrKey: visit.selectedEhrKey });
    }
  }, [readOnly, visit.id, visit.note.status, visit.codes.status, visit.ehr, visit.selectedEhrKey, runStep]);

  // While anything is running (for example after a page refresh), poll the saved visit.
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(async () => {
      try {
        const { visit: next } = await api<VisitResponse>(`/api/visits/${visit.id}`);
        setVisit(next);
      } catch {
        // keep the last known state
      }
    }, 2000);
    return () => clearInterval(t);
  }, [anyRunning, visit.id]);

  async function selectEhr(key: string) {
    setActionError(null);
    if (readOnly) {
      setVisit((v) => ({ ...v, selectedEhrKey: key }));
    } else if (visit.ehr[key]) {
      const { visit: next } = await postJson<VisitResponse>(`/api/visits/${visit.id}/ehr`, { ehrKey: key, run: false });
      setVisit(next);
    } else {
      setVisit((v) => ({ ...v, selectedEhrKey: key, ehr: { ...v.ehr, [key]: { status: "running" } } }));
      await runStep(`ehr:${key}`, `/api/visits/${visit.id}/ehr`, { ehrKey: key });
    }
  }

  async function removeVisit() {
    if (!window.confirm("Delete this visit? This cannot be undone.")) return;
    try {
      await api(`/api/visits/${visit.id}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (err) {
      setActionError(asAppError(err));
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof FileText; status?: StepStatus }> = [
    { id: "note", label: "Note", icon: FileText, status: visit.note.status },
    { id: "transcript", label: "Transcript", icon: MessageSquareText },
    { id: "codes", label: "Codes", icon: Tags, status: visit.codes.status },
    { id: "ehr", label: "EHR JSON", icon: Braces, status: ehrStep.status },
  ];

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setTab(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  const firstName = visit.patient.name?.split(" ")[0];

  return (
    <div className="flex flex-col">
      <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-6 pt-10 pb-10">
        <p className="text-[14px] text-graphite">{formatDate(visit.createdAt)}</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-[40px] leading-[1.1] tracking-[-0.03em] md:text-[48px]">
            {firstName ? `${firstName}'s` : "Patient"} <span className="text-sky">visit</span>
          </h1>
          {readOnly ? null : (
            <Button variant="secondary" size="sm" onClick={removeVisit}>
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              Delete visit
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{patientLabel(visit.patient)}</Badge>
          <Badge tone="outline">
            {visit.provider.name}, {visit.provider.credentials} · {visit.provider.specialty}
          </Badge>
          {formerProvider ? <Badge>Former provider</Badge> : null}
          {readOnly ? <Badge tone="outline">Read only</Badge> : null}
          <Badge tone="outline">{visit.templateName}</Badge>
          <Badge tone="outline">{INPUT_LABELS[visit.inputMethod]}</Badge>
          {visit.demo ? <DemoBadge /> : null}
        </div>
      </section>

      <section className="bg-cream">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-10">
          <div role="tablist" aria-label="Visit results" className="flex flex-wrap gap-1 rounded-full border border-fog bg-paper p-1 md:w-fit">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] ${active ? "bg-ink font-medium text-paper" : "text-ink hover:bg-cream"}`}
                >
                  {t.status === "running" ? (
                    <LoaderCircle aria-label="Loading" className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={1.5} />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>

          {actionError ? <ErrorNotice error={actionError} /> : null}

          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "note" ? <NotePanel visit={visit} onRetry={readOnly ? undefined : () => runStep("note", `/api/visits/${visit.id}/note`)} /> : null}
            {tab === "transcript" ? <TranscriptPanel transcript={visit.transcript} /> : null}
            {tab === "codes" ? <CodesPanel visit={visit} onRegenerate={readOnly ? undefined : () => runStep("codes", `/api/visits/${visit.id}/codes`)} /> : null}
            {tab === "ehr" ? (
              <EhrPanel
                visit={visit}
                ehrs={ehrs}
                onSelect={selectEhr}
                onRerun={
                  readOnly ? undefined : () => runStep(`ehr:${visit.selectedEhrKey}`, `/api/visits/${visit.id}/ehr`, { ehrKey: visit.selectedEhrKey })
                }
              />
            ) : null}
          </div>

          <ApiCallsPanel calls={visit.calls} />
        </div>
      </section>
    </div>
  );
}
