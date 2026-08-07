"use client";

import { cn } from "@/lib/cn";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  count?: number;
};

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = "md",
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "tab-list -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-[var(--radius-sm)] font-medium transition-all duration-200",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              size === "sm" ? "px-3 py-2 text-sm" : "px-3.5 py-2.5 text-sm",
              selected
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 ? (
              <span
                className={cn(
                  "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-[var(--accent-soft)] text-[var(--accent)]",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn("animate-fade-up space-y-6 pt-5", className)}
    >
      {children}
    </div>
  );
}
