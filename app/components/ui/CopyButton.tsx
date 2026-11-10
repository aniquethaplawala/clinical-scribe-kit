"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-fog bg-paper px-3 py-1.5 text-[14px] text-ink hover:bg-cream ${className}`}
    >
      {copied ? <Check aria-hidden className="h-4 w-4" strokeWidth={1.5} /> : <Copy aria-hidden className="h-4 w-4" strokeWidth={1.5} />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

export function DownloadButton({ text, filename, label = "Download", type = "application/json" }: { text: string; filename: string; label?: string; type?: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-full border border-fog bg-paper px-3 py-1.5 text-[14px] text-ink hover:bg-cream"
    >
      {label}
    </button>
  );
}
