"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Container } from "@/components/ui";

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
      <div className="border-b border-[var(--warning)]/20 bg-[var(--warning-soft)] px-4 py-2.5 text-sm text-[var(--warning)]">
        <Container size="wide">Checking view-as access…</Container>
      </div>
    );
  }

  if (context === null) {
    return (
      <div className="border-b border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-2.5 text-sm text-[var(--danger)]">
        <Container size="wide" className="flex flex-wrap items-center justify-between gap-2">
          <span>You don&apos;t have permission to view as this student.</span>
          <Link
            href="/family/dashboard"
            className="font-medium underline-offset-2 hover:underline"
          >
            Back to family
          </Link>
        </Container>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-2.5 text-sm text-[var(--warning)]">
      <Container size="wide" className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <StudentAvatar
            studentId={context.student._id}
            imageStorageId={context.student.imageStorageId}
            name={context.student.displayName}
            size="sm"
          />
          <span>
            Viewing as{" "}
            <strong className="font-semibold">{context.student.displayName}</strong>
            <span className="opacity-80">
              {" "}
              — actions are recorded as you (parent)
            </span>
          </span>
        </span>
        <Link
          href="/family/dashboard"
          className="rounded-[var(--radius-sm)] border border-[var(--warning)]/40 bg-[var(--surface)] px-3 py-1 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
        >
          Exit
        </Link>
      </Container>
    </div>
  );
}
