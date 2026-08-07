import { cn } from "@/lib/cn";

/** Max-width page shell — Bootstrap-like container. */
export function Container({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "narrow" | "default" | "wide";
}) {
  const max =
    size === "narrow"
      ? "max-w-lg"
      : size === "wide"
        ? "max-w-6xl"
        : "max-w-5xl";
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", max, className)}>
      {children}
    </div>
  );
}

/**
 * 12-column responsive grid (Bootstrap-like rows/cols).
 * Use Col with span props for breakpoints.
 */
export function Row({
  children,
  className,
  gap = "md",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: "sm" | "md" | "lg";
}) {
  const gaps = { sm: "gap-3", md: "gap-5", lg: "gap-8" };
  return (
    <div className={cn("grid grid-cols-12", gaps[gap], className)}>
      {children}
    </div>
  );
}

type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const spanClass: Record<Span, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

const smSpanClass: Record<Span, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  5: "sm:col-span-5",
  6: "sm:col-span-6",
  7: "sm:col-span-7",
  8: "sm:col-span-8",
  9: "sm:col-span-9",
  10: "sm:col-span-10",
  11: "sm:col-span-11",
  12: "sm:col-span-12",
};

const mdSpanClass: Record<Span, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

const lgSpanClass: Record<Span, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

export function Col({
  children,
  className,
  span = 12,
  sm,
  md,
  lg,
}: {
  children: React.ReactNode;
  className?: string;
  span?: Span;
  sm?: Span;
  md?: Span;
  lg?: Span;
}) {
  return (
    <div
      className={cn(
        spanClass[span],
        sm ? smSpanClass[sm] : null,
        md ? mdSpanClass[md] : null,
        lg ? lgSpanClass[lg] : null,
        className,
      )}
    >
      {children}
    </div>
  );
}
