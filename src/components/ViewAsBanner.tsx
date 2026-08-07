"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";

export function ViewAsBanner() {
  const studentId = useViewAsStudentId();
  const context = useQuery(
    api.students.getViewAsContext,
    studentId ? { studentId } : "skip",
  );

  if (!studentId) {
    return null;
  }

  if (context === undefined) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <div className="mx-auto max-w-4xl">Checking view-as access…</div>
      </div>
    );
  }

  if (context === null) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <span>You don&apos;t have permission to view as this student.</span>
          <Link href="/family/dashboard" className="underline">
            Back to family
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <span>
          Viewing as <strong>{context.student.displayName}</strong>
          <span className="text-amber-800">
            {" "}
            — actions are recorded as you (parent)
          </span>
        </span>
        <Link
          href="/family/dashboard"
          className="border border-amber-800 px-2 py-0.5 text-amber-950 hover:bg-amber-100"
        >
          Exit
        </Link>
      </div>
    </div>
  );
}
