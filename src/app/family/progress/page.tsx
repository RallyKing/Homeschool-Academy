"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  Button,
  Section,
  PageHeader,
  EmptyState,
} from "@/components/ui";

export default function FamilyProgressPage() {
  const students = useQuery(api.students.listForMyFamily);

  if (students === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <Link href="/family/dashboard">
        <Button variant="ghost" size="sm">
          ← Family
        </Button>
      </Link>

      <PageHeader
        title="Progress"
        description="Open a student dashboard for charts of learning minutes over time."
      />

      {students.length === 0 ? (
        <EmptyState>
          <Link href="/family/dashboard">
            <Button variant="secondary" size="sm">
              Add a student
            </Button>
          </Link>{" "}
          to view progress.
        </EmptyState>
      ) : (
        <Section title="Students">
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s._id} className="list-row">
                <div className="flex min-w-0 items-center gap-3">
                  <StudentAvatar
                    studentId={s._id}
                    imageStorageId={s.imageStorageId}
                    name={s.displayName}
                    size="md"
                  />
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {s.displayName}
                    </p>
                    {s.academicLevel && (
                      <p className="text-sm text-[var(--muted)]">
                        {s.academicLevel}
                      </p>
                    )}
                  </div>
                </div>
                <Link href={`/family/progress/${s._id}`}>
                  <Button variant="secondary" size="sm">
                    Progress dashboard
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
