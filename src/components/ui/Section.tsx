import { cn } from "@/lib/cn";

export function Section({
  children,
  className,
  title,
  description,
  action,
  id,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("animate-fade-up space-y-4", className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title ? (
              <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Interactive surface only — avoid decorative cards. */
export function Card({
  children,
  className,
  padding = "md",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  interactive?: boolean;
}) {
  const pads = { sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" };
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        pads[padding],
        interactive &&
          "transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "animate-fade-up mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-base text-[var(--muted)] leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-transparent",
    success: "bg-[rgba(4,120,87,0.1)] text-[var(--success)] border-transparent",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-transparent",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-8 text-center text-sm text-[var(--muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Message({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error" | "success";
}) {
  if (!children) return null;
  const tones = {
    info: "text-[var(--muted)]",
    error: "text-[var(--danger)]",
    success: "text-[var(--success)]",
  };
  return <p className={cn("text-sm", tones[tone])}>{children}</p>;
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  // Avoid importing next/link here for SSR flexibility — pages can wrap Link.
  const variants = {
    primary:
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border-transparent",
    secondary:
      "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
    ghost: "bg-transparent text-[var(--muted)] border-transparent hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
  };
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 active:scale-[0.98]",
        variants[variant],
        className,
      )}
    >
      {children}
    </a>
  );
}
