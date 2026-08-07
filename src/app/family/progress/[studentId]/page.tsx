"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { StudentProgressCharts } from "@/components/StudentProgressCharts";

export default function StudentProgressDashboardPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId: rawId } = use(params);
  const studentId = rawId as Id<"students">;

  const student = useQuery(api.students.get, { studentId });

  if (student === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (student === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          <Link href="/family/progress" className="underline">
            ← Progress
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Student not found</h1>
        <p className="text-sm text-neutral-600">
          You may not have access to this student profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/family/progress" className="underline">
            ← Progress
          </Link>
          {" · "}
          <Link href="/family/dashboard" className="underline">
            Family
          </Link>
          {" · "}
          <Link
            href={`/student/dashboard?as=${student._id}`}
            className="underline"
          >
            View as student
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {student.displayName}
        </h1>
        <p className="text-sm text-neutral-600">
          {student.academicLevel ?? "Student"} · progress dashboard
        </p>
      </div>

      <StudentProgressCharts
        studentId={student._id}
        defaultRangeDays={30}
      />
    </div>
  );
}
