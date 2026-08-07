"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { usePathname, useSearchParams } from "next/navigation";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  BREADCRUMB_HIDDEN_PATHS,
  breadcrumbParams,
  buildBreadcrumbs,
} from "@/lib/breadcrumbs";

/**
 * Resolves the current route into a breadcrumb trail and renders it.
 * Mount once in the app shell (root layout) so every authenticated page is covered.
 */
export function BreadcrumbBar() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const user = useQuery(api.users.current);

  const normalized = pathname.replace(/\/$/, "") || "/";
  const hidden =
    BREADCRUMB_HIDDEN_PATHS.has(normalized) ||
    user === undefined ||
    user === null;

  const { studentId, articleSlug } = breadcrumbParams(normalized);

  const student = useQuery(
    api.students.get,
    !hidden && studentId
      ? { studentId: studentId as Id<"students"> }
      : "skip",
  );

  const article = useQuery(
    api.knowledgeBase.getBySlug,
    !hidden && articleSlug ? { slug: articleSlug } : "skip",
  );

  const items = useMemo(() => {
    if (hidden) return null;
    return buildBreadcrumbs({
      pathname: normalized,
      tab,
      role: user?.role,
      labels: {
        studentName: student?.displayName,
        articleTitle: article?.title,
      },
    });
  }, [
    hidden,
    normalized,
    tab,
    user?.role,
    student?.displayName,
    article?.title,
  ]);

  if (!items || items.length === 0) return null;

  return <Breadcrumbs items={items} />;
}
