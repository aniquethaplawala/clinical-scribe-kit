import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import type { SuggestedCode, Visit } from "@/lib/types";
import { Loading, Panel } from "./Panel";

function codesAsText(codes: SuggestedCode[]): string {
  return codes.map((c) => `${c.system}\t${c.code}\t${c.description}\t"${c.evidence}"\t${c.confidence}`).join("\n");
}

export function CodesPanel({ visit, onRegenerate }: { visit: Visit; onRegenerate?: () => void }) {
  const { codes } = visit;
  const list = codes.result?.codes ?? [];
  const busy = codes.status === "running" || codes.status === "idle";
  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-3">
          Suggested codes <Badge tone="sky">Review before use</Badge>
        </span>
      }
      actions={
        <>
          {list.length ? <CopyButton text={codesAsText(list)} label="Copy codes" /> : null}
          {onRegenerate && (codes.status === "done" || codes.status === "error") ? (
            <Button variant="secondary" size="sm" onClick={onRegenerate}>
              <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              Suggest again
            </Button>
          ) : null}
        </>
      }
    >
      {busy ? <Loading label={visit.note.status === "done" ? "Suggesting codes..." : "Waiting for the note..."} /> : null}
      {codes.status === "error" && codes.error ? <ErrorNotice error={codes.error} /> : null}
      {codes.status === "done" && list.length === 0 ? (
        <p className="rounded-[16px] bg-cream p-6 text-graphite">No codes could be supported by the note.</p>
      ) : null}
      {list.length ? (
        <ul className="flex flex-col divide-y divide-fog border-y border-fog">
          {list.map((c) => (
            <li key={`${c.system}:${c.code}`} className="grid grid-cols-1 gap-3 py-5 md:grid-cols-[180px_1fr_auto] md:gap-6">
              <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-1.5">
                <span className="font-mono text-[18px] font-semibold">{c.code}</span>
                <Badge tone="outline">{c.system}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[16px] font-medium">{c.description}</p>
                <blockquote className="border-l-2 border-sky pl-3 text-[14px] text-graphite">
                  &ldquo;{c.evidence}&rdquo;
                  {c.evidenceMatch === "approximate" ? <span className="ml-2 text-[12px]">(close match in the note)</span> : null}
                </blockquote>
              </div>
              <div className="flex items-start">
                <Badge tone={c.confidence === "high" ? "sky" : "fog"}>{c.confidence} confidence</Badge>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {codes.result?.removed ? (
        <p className="text-[14px] text-graphite">
          {codes.result.removed} suggestion{codes.result.removed === 1 ? " was" : "s were"} removed because the code was malformed or its quote was not found in the note.
        </p>
      ) : null}
    </Panel>
  );
}
