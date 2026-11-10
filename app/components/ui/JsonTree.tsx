"use client";

import { useState, type ReactNode } from "react";

/** A small collapsible JSON viewer built on <details>, so it is keyboard accessible for free. */
export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="overflow-x-auto rounded-[4px] bg-cream p-4 font-mono text-[13px] leading-6">
      <Node value={value} depth={0} />
    </div>
  );
}

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const label = name !== undefined ? <span className="text-ink">{JSON.stringify(name)}: </span> : null;
  if (value === null || typeof value !== "object") {
    return (
      <div className="whitespace-pre-wrap break-words">
        {label}
        <Primitive value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  const open = Array.isArray(value) ? "[" : "{";
  const close = Array.isArray(value) ? "]" : "}";
  if (entries.length === 0) {
    return (
      <div>
        {label}
        <span className="text-graphite">
          {open}
          {close}
        </span>
      </div>
    );
  }
  return <Branch label={label} entries={entries} isArray={Array.isArray(value)} depth={depth} open={open} close={close} />;
}

function Branch({
  label,
  entries,
  isArray,
  depth,
  open: openChar,
  close,
}: {
  label: ReactNode;
  entries: ReadonlyArray<readonly [string, unknown]>;
  isArray: boolean;
  depth: number;
  open: string;
  close: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer list-none rounded-[4px] hover:bg-fog/40 [&::-webkit-details-marker]:hidden">
        <span className={`inline-block w-4 text-graphite transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        {label}
        <span className="text-graphite">
          {openChar}
          {open ? null : ` ${entries.length} ${isArray ? "items" : "keys"} ${close}`}
        </span>
      </summary>
      {open ? (
        <>
          <div className="ml-2 border-l border-fog pl-4">
            {entries.map(([k, v]) => (
              <Node key={k} name={isArray ? undefined : k} value={v} depth={depth + 1} />
            ))}
          </div>
          <div className="pl-4 text-graphite">{close}</div>
        </>
      ) : null}
    </details>
  );
}

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-graphite italic">null</span>;
  if (typeof value === "string") {
    const shown = value.length > 600 ? `${value.slice(0, 600)}... (${value.length} characters)` : value;
    return <span className="text-graphite">{JSON.stringify(shown)}</span>;
  }
  return <span className="font-semibold text-ink">{String(value)}</span>;
}
