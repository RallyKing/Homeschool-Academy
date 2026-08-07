"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { StudentProgressCharts } from "@/components/StudentProgressCharts";
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

      <PageHeader
        eyebrow="Progress dashboard"
        title={student.displayName}
        description={`${student.academicLevel ?? "Student"} · learning charts and totals`}
      />

      <Card padding="lg">
        <StudentProgressCharts
          studentId={student._id}
          defaultRangeDays={30}
        />
      </Card>
    </div>
  );
}
