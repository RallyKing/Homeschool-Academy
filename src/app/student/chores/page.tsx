"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  PageHeader,
  Select,
} from "@/components/ui";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { withViewAs } from "@/lib/viewAs";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return { weekStart: isoDate(start), today: isoDate(now) };
}

function StudentChoresInner() {
  const viewAsStudentId = useViewAsStudentId();
  const week = useMemo(() => weekRange(), []);
  const myProfile = useQuery(
    api.students.myProfile,
    viewAsStudentId ? "skip" : {},
  );
  const viewAsContext = useQuery(
    api.students.getViewAsContext,
    viewAsStudentId ? { studentId: viewAsStudentId } : "skip",
  );

  const profile = viewAsStudentId
    ? (viewAsContext?.student ?? null)
    : (myProfile ?? null);

  const [statusFilter, setStatusFilter] = useState<"todo" | "done" | "all">(
    "todo",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );

  const chores = useQuery(
    api.chores.listMine,
    profile
      ? {
          studentId: profile._id,
          status: statusFilter === "all" ? undefined : statusFilter,
        }
      : "skip",
  );

  const markDone = useMutation(api.chores.markDone);
  const skip = useMutation(api.chores.skip);

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  if (myProfile === undefined && !viewAsStudentId) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (viewAsStudentId && viewAsContext === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!profile) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Student"
          title="Chores"
          description="Link your student profile to see assigned chores."
        />
        <Link href={withViewAs("/student/dashboard", viewAsStudentId)}>
          <Button variant="secondary">Back to Today</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Life"
        title="Chores"
        description="Finish tasks to earn XP and points."
        actions={
          <Link href={withViewAs("/student/dashboard", viewAsStudentId)}>
            <Button variant="secondary" size="sm">
              Dashboard
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem]">
          <Select
            label="Show"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "todo" | "done" | "all")
            }
          >
            <option value="todo">Open</option>
            <option value="done">Done</option>
            <option value="all">All</option>
          </Select>
        </div>
      </div>

      <Message tone={messageTone}>{message}</Message>

      {chores === undefined ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : chores.length === 0 ? (
        <EmptyState>
          Nothing here — check back when a parent assigns chores.
        </EmptyState>
      ) : (
        <ul className="space-y-1.5">
          {chores.map((c) => (
            <li key={c._id} className="list-row list-row-dense">
              <div className="min-w-0">
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-[var(--muted)]">
                  {c.description ? `${c.description} · ` : ""}
                  {c.dueDate ? `due ${c.dueDate} · ` : ""}
                  {c.recurrence}
                  {c.xpReward ? ` · +${c.xpReward} XP` : ""}
                  {c.pointsReward ? ` · +${c.pointsReward} pts` : ""}
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge
                  tone={
                    c.status === "done"
                      ? "success"
                      : c.status === "skipped"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {c.status}
                </Badge>
                {c.status === "todo" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        void markDone({
                          choreId: c._id as Id<"chores">,
                          today: week.today,
                          weekStart: week.weekStart,
                        })
                          .then((result) =>
                            notify(
                              result.leveledUp
                                ? `Level up to ${result.newLevel}! +${result.xpGained} XP`
                                : `Done! +${result.xpGained} XP · +${result.pointsGained} pts`,
                            ),
                          )
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      Done
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void skip({ choreId: c._id as Id<"chores"> })
                          .then(() => notify("Skipped.", "info"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      Skip
                    </Button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StudentChoresPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <StudentChoresInner />
    </Suspense>
  );
}
