"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function FamilyProgressPage() {
  const students = useQuery(api.students.listForMyFamily);

  if (students === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/family/dashboard" className="underline">
            ← Family
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Progress</h1>
        <p className="text-sm text-neutral-600">
          Open a student dashboard for charts of learning minutes over time.
        </p>
      </div>

      {students.length === 0 ? (
        <p className="text-sm">
          <Link href="/family/dashboard" className="underline">
            Add a student
          </Link>{" "}
          first.
        </p>
      ) : (
        <ul className="text-sm">
          {students.map((s) => (
            <li
              key={s._id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-3"
            >
              <span>
                {s.displayName}
                {s.academicLevel ? ` · ${s.academicLevel}` : ""}
              </span>
              <Link
                href={`/family/progress/${s._id}`}
                className="underline"
              >
                Progress dashboard
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
