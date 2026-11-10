import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

/** White card on cream with a title row and optional actions. */
export function Panel({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 rounded-[16px] bg-paper p-6 md:p-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <h2 className="text-[24px] font-medium tracking-[-0.02em]">{title}</h2>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-[16px] bg-cream p-6 text-[16px] text-graphite">
      <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" strokeWidth={1.5} />
      {label}
    </div>
  );
}
