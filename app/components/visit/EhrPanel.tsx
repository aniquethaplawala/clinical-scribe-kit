import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CopyButton, DownloadButton } from "@/components/ui/CopyButton";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Select } from "@/components/ui/Field";
import { JsonTree } from "@/components/ui/JsonTree";
import type { EhrSummary, Visit } from "@/lib/types";
import { Loading, Panel } from "./Panel";

export function EhrPanel({
  visit,
  ehrs,
  onSelect,
  onRerun,
}: {
  visit: Visit;
  ehrs: EhrSummary[];
  onSelect: (key: string) => void;
  onRerun?: () => void;
}) {
  const key = visit.selectedEhrKey;
  const step = visit.ehr[key];
  const ehr = ehrs.find((e) => e.key === key);
  const json = step?.result ? JSON.stringify(step.result.data, null, 2) : "";

  return (
    <Panel
      title="EHR JSON"
      actions={
        json ? (
          <>
            <CopyButton text={json} label="Copy JSON" />
            <DownloadButton text={json} filename={`${key}-${visit.id.slice(0, 8)}.json`} />
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="md:w-80">
          <Field label="Target EHR" htmlFor="ehr-select">
            <Select id="ehr-select" value={key} onChange={(e) => onSelect(e.target.value)} disabled={step?.status === "running"}>
              {ehrs.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.name}
                  {visit.ehr[e.key]?.status === "done" ? " (done)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {onRerun && step && (step.status === "done" || step.status === "error") ? (
          <Button variant="secondary" size="sm" onClick={onRerun}>
            <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            Run again
          </Button>
        ) : null}
      </div>
      {ehr?.verdict ? (
        <p className="rounded-[16px] bg-cream px-5 py-4 text-[14px]">
          <span className="font-medium">Write-back: </span>
          {ehr.verdict}
        </p>
      ) : null}
      {!step && !onRerun ? <p className="rounded-[16px] bg-cream p-6 text-graphite">Not extracted for this EHR.</p> : null}
      {(!step && onRerun) || step?.status === "running" || step?.status === "idle" ? (
        <Loading label={visit.note.status === "done" ? "Extracting structured data..." : "Waiting for the note..."} />
      ) : null}
      {step?.status === "error" && step.error ? <ErrorNotice error={step.error} /> : null}
      {step?.result ? <JsonTree value={step.result.data} /> : null}
    </Panel>
  );
}
