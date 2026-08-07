import Link from "next/link";
import { cn } from "@/lib/cn";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";

export type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
  /** Accessible name for the nav landmark */
  label?: string;
};

/**
 * Subtle Apple-like breadcrumb trail.
 * Last item is the current page (`aria-current="page"`).
 */
export function Breadcrumbs({
  items,
  className,
  label = "Breadcrumb",
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className={cn(
        "mb-4 inline-flex max-w-full animate-fade-up",
        className,
      )}
    >
      <ol
        className={cn(
          "flex flex-wrap items-center gap-x-1 gap-y-1",
          "rounded-[var(--radius-sm)] border border-[var(--border)]",
          "bg-[var(--surface)]/80 px-2.5 py-1.5",
          "text-[13px] leading-none shadow-[var(--shadow-sm)]",
          "backdrop-blur-sm",
        )}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const showLink = Boolean(item.href) && !isLast;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <span
                  aria-hidden
                  className="mx-0.5 select-none text-[var(--muted-fg)]"
                >
                  /
                </span>
              ) : null}
              {showLink ? (
                <Link
                  href={item.href!}
                  className={cn(
                    "rounded-md px-1.5 py-1 font-medium text-[var(--muted)]",
                    "transition-colors duration-200",
                    "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "rounded-md px-1.5 py-1 font-medium",
                    isLast
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)]",
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
