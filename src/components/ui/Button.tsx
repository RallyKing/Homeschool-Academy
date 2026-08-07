import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-hover)] border border-transparent",
  secondary:
    "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border-strong)] shadow-sm hover:bg-[var(--surface-2)]",
  ghost:
    "bg-transparent text-[var(--muted)] border border-transparent hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger)] border border-transparent hover:bg-[rgba(185,28,28,0.14)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-[var(--radius-sm)]",
  md: "px-4 py-2.5 text-sm rounded-[var(--radius-md)]",
  lg: "px-5 py-3 text-base rounded-[var(--radius-md)]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200",
        "disabled:pointer-events-none disabled:opacity-45",
        "active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
