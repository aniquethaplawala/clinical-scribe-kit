import type { ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-[16px] border border-fog bg-paper p-6 md:p-8 ${className}`}>{children}</Tag>;
}

/** Page opener: serif display heading with one highlighted word. */
export function PageHeading({ before, highlight, after = "", children }: { before: string; highlight: string; after?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-serif text-[40px] leading-[1.1] font-normal tracking-[-0.03em] md:text-[48px]">
        {before} <span className="text-sky">{highlight}</span>
        {after}
      </h1>
      {children ? <div className="max-w-2xl text-[16px] text-graphite">{children}</div> : null}
    </div>
  );
}
