import type { ReactNode } from "react";

/** Pill badge: fog fill by default, sky fill for the single accent. */
export function Badge({ children, tone = "fog", className = "" }: { children: ReactNode; tone?: "fog" | "sky" | "outline"; className?: string }) {
  const tones = {
    fog: "bg-fog text-ink",
    sky: "bg-sky text-ink",
    outline: "border border-fog bg-paper text-graphite",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[30px] px-3 py-1 text-[12px] font-medium tracking-[0.02em] whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function DemoBadge() {
  return <Badge>Demo mode: add your Sully keys in .env.local</Badge>;
}
