"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { StudentProgressCharts } from "@/components/StudentProgressCharts";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Button, PageHeader, Card } from "@/components/ui";

export default function StudentProgressDashboardPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId: rawId } = use(params);
  const studentId = rawId as Id<"students">;

  const student = useQuery(api.students.get, { studentId });

  if (student === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (student === null) {
    return (
      <div className="space-y-6">
        <Link href="/family/progress">
          <Button variant="ghost" size="sm">
            ← Progress
          </Button>
        </Link>
        <PageHeader
          title="Student not found"
          description="You may not have access to this student profile."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/family/progress">
          <Button variant="ghost" size="sm">
            ← Progress
          </Button>
        </Link>
        <Link href="/family/dashboard">
          <Button variant="ghost" size="sm">
            Family
          </Button>
        </Link>
        <Link href={`/student/dashboard?as=${student._id}`}>
          <Button variant="secondary" size="sm">
            View as student
          </Button>
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6 animate-fade-up">
        <div className="flex min-w-0 items-center gap-4">
          <StudentAvatar
            studentId={student._id}
            imageStorageId={student.imageStorageId}
            name={student.displayName}
            size="lg"
          />
          <div className="min-w-0 max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Progress dashboard
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
              {student.displayName}
            </h1>
            <p className="mt-2 text-base text-[var(--muted)] leading-relaxed">
              {`${student.academicLevel ?? "Student"} · learning charts and totals`}
            </p>
          </div>
        </div>
      </div>

      <Card padding="lg">
        <StudentProgressCharts
          studentId={student._id}
          defaultRangeDays={30}
        />
      </Card>
    </div>
  );
}
