"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { FamilyWallFeed } from "@/components/FamilyWallFeed";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export default function AcademyCheersPage() {
  const families = useQuery(api.feed.listTeacherCheerFamilies);
  const [selectedFamilyId, setSelectedFamilyId] = useState<
    Id<"families"> | ""
  >("");
  const [targetStudentId, setTargetStudentId] = useState<
    Id<"students"> | ""
  >("");

  const selected = useMemo(
    () => families?.find((f) => f.familyId === selectedFamilyId) ?? null,
    [families, selectedFamilyId],
  );

  if (families === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Academy"
        title="Student cheers"
        description="Encourage families you teach — react, comment, and cheer on their private walls."
      />

      {families.length === 0 ? (
        <EmptyState>
          No subscribed families yet. When a family activates your academy,
          their cheer wall appears here.
        </EmptyState>
      ) : (
        <>
          <Section
            title="My students’ circles"
            description="Pick a family wall to celebrate with them."
          >
            <ul className="space-y-2">
              {families.map((f) => {
                const active = selectedFamilyId === f.familyId;
                return (
                  <li key={`${f.academyId}-${f.familyId}`}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition",
                        "hover-lift border-[var(--border)] bg-[var(--surface)]",
                        active &&
                          "border-[var(--accent)] bg-[var(--accent-soft)]",
                      )}
                      onClick={() => {
                        setSelectedFamilyId(f.familyId);
                        setTargetStudentId(f.students[0]?._id ?? "");
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {f.familyName}
                        </span>
                        <Badge tone="neutral">{f.academyName}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {f.students.map((s) => (
                          <span
                            key={s._id}
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"
                          >
                            <StudentAvatar
                              studentId={s._id}
                              imageStorageId={s.imageStorageId}
                              name={s.displayName}
                              size="sm"
                            />
                            {s.displayName}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          {selected ? (
            <>
              {selected.students.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selected.students.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                        targetStudentId === s._id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)]",
                      )}
                      onClick={() => setTargetStudentId(s._id)}
                    >
                      <StudentAvatar
                        studentId={s._id}
                        imageStorageId={s.imageStorageId}
                        name={s.displayName}
                        size="sm"
                      />
                      Cheer {s.displayName}
                    </button>
                  ))}
                </div>
              ) : null}
              <FamilyWallFeed
                familyId={selected.familyId}
                canCompose
                defaultTargetStudentId={
                  targetStudentId || selected.students[0]?._id
                }
              />
            </>
          ) : (
            <EmptyState>Select a family above to open their wall.</EmptyState>
          )}
        </>
      )}
    </div>
  );
}
