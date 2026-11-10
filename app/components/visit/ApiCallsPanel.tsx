import { ChevronRight, Code } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import type { ApiCall } from "@/lib/types";

/** The "how do I replicate this" panel: every Sully request made for this visit. */
export function ApiCallsPanel({ calls }: { calls: ApiCall[] }) {
  return (
    <details className="group/calls rounded-[16px] border border-fog bg-paper">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[16px] p-6 md:px-10 [&::-webkit-details-marker]:hidden">
        <Code aria-hidden className="h-5 w-5" strokeWidth={1.5} />
        <span className="text-[18px] font-medium">API calls</span>
        <Badge>{calls.length}</Badge>
        <ChevronRight aria-hidden className="ml-auto h-5 w-5 transition-transform group-open/calls:rotate-90" strokeWidth={1.5} />
      </summary>
      <div className="flex flex-col gap-3 px-6 pb-6 md:px-10 md:pb-10">
        {calls.length === 0 ? <p className="text-graphite">No calls recorded yet.</p> : null}
        {calls.map((call) => (
          <CallRow key={call.id} call={call} />
        ))}
      </div>
    </details>
  );
}

function CallRow({ call }: { call: ApiCall }) {
  return (
    <details className="group rounded-[16px] bg-cream">
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[16px] p-4 [&::-webkit-details-marker]:hidden">
        <span className="rounded-[4px] bg-paper px-2 py-0.5 font-mono text-[12px] font-semibold">{call.method}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-[14px]">{call.path}</span>
          <span className="truncate text-[12px] text-graphite">{call.label}</span>
        </span>
        <span className="flex items-center gap-2 text-[12px] text-graphite">
          {call.demo ? <Badge tone="outline">Demo</Badge> : null}
          <span className="font-medium text-ink">{call.status ?? "no response"}</span>
          <span className="hidden sm:inline">{formatMs(call.latencyMs)}</span>
          <ChevronRight aria-hidden className="h-4 w-4 transition-transform group-open:rotate-90" strokeWidth={1.5} />
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-fog p-4 text-[14px]">
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-graphite">Status</dt>
          <dd>
            {call.status ?? "no response"} {call.ok ? "" : "(failed)"}
          </dd>
          <dt className="text-graphite">Latency</dt>
          <dd>{formatMs(call.latencyMs)}</dd>
          <dt className="text-graphite">Request ID</dt>
          <dd className="font-mono text-[13px] break-all">{call.requestId ?? "none"}</dd>
          <dt className="text-graphite">Time</dt>
          <dd>{new Date(call.at).toLocaleTimeString()}</dd>
          {Object.entries(call.requestHeaders).map(([k, v]) => (
            <HeaderRow key={k} name={k} value={v} />
          ))}
        </dl>
        {call.note ? <p className="text-graphite">{call.note}</p> : null}
        {call.error ? <p className="font-medium">Error: {call.error}</p> : null}
        {call.requestBody ? <CodeBlock title="Request body (truncated)" text={call.requestBody} /> : null}
        {call.responsePreview ? <CodeBlock title="Response" text={call.responsePreview} /> : null}
        <CodeBlock title={call.method === "WS" ? "Command" : "curl"} text={call.curl} copy collapsedLines={14} />
      </div>
    </details>
  );
}

function HeaderRow({ name, value }: { name: string; value: string }) {
  return (
    <>
      <dt className="text-graphite">{name}</dt>
      <dd className="font-mono text-[13px] break-all">{value}</dd>
    </>
  );
}

function CodeBlock({ title, text, copy = false, collapsedLines }: { title: string; text: string; copy?: boolean; collapsedLines?: number }) {
  const lines = text.split("\n");
  const shown = collapsedLines && lines.length > collapsedLines ? `${lines.slice(0, collapsedLines).join("\n")}\n...` : text;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium tracking-[0.02em] text-graphite uppercase">{title}</span>
        {copy ? <CopyButton text={text} label={`Copy ${title.toLowerCase()}`} /> : null}
      </div>
      <pre className="max-h-80 overflow-auto rounded-[4px] bg-paper p-3 font-mono text-[12px] leading-5 whitespace-pre-wrap break-all">{shown}</pre>
    </div>
  );
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}
