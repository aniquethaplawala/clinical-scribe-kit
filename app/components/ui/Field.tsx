import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-[4px] border border-fog bg-paper px-3 py-2.5 text-[16px] text-ink placeholder:text-graphite/60 hover:border-silver focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-ink";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[12px] text-graphite">{hint}</p> : null}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select {...props} className={`${inputClass} appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10 ${props.className ?? ""}`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2328262a' stroke-width='1.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} />
  );
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} font-sans leading-relaxed ${props.className ?? ""}`} />;
}
