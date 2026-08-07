import type { Id } from "../../convex/_generated/dataModel";

export const VIEW_AS_PARAM = "as";

export function studentDashboardHref(studentId: Id<"students"> | string) {
  return `/student/dashboard?${VIEW_AS_PARAM}=${studentId}`;
}

export function withViewAs(
  href: string,
  studentId: string | null | undefined,
): string {
  if (!studentId) return href;
  const url = new URL(href, "http://local");
  url.searchParams.set(VIEW_AS_PARAM, studentId);
  return `${url.pathname}${url.search}`;
}
