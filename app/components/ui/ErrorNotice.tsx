import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { AppError } from "@/lib/types";

/** Errors use ink text in a fog pill-shaped panel with an icon (no red, per the design system). */
export function ErrorNotice({ error, action }: { error: AppError; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[16px] border border-fog bg-cream p-5 sm:flex-row sm:items-start">
      <CircleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-[16px] font-medium">{error.title}</p>
        <p className="text-[14px] text-graphite">{error.message}</p>
        {error.status || error.requestId ? (
          <p className="text-[12px] text-graphite">
            {error.status ? `HTTP ${error.status}` : ""}
            {error.code ? ` · ${error.code}` : ""}
            {error.requestId ? ` · request ${error.requestId}` : ""}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
