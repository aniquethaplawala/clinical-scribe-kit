import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-[16px] font-medium tracking-[-0.02em] transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-sage px-5 py-3 text-ink hover:brightness-95",
  secondary: "border border-fog bg-paper px-5 py-[11px] text-ink hover:bg-cream",
  ghost: "px-2 py-1 text-[14px] font-normal text-ink hover:underline underline-offset-4",
};
const small = "!px-4 !py-2 !text-[14px]";

export function buttonClass(variant: Variant = "primary", size: "md" | "sm" = "md"): string {
  return `${base} ${variants[variant]} ${size === "sm" ? small : ""}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "md" | "sm" }) {
  return <button type="button" className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "md" | "sm";
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}
