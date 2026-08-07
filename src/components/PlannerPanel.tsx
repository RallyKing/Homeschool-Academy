"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Button,
  Select,
  Section,
  Card,
  Badge,
  EmptyState,
  Message,
} from "@/components/ui";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { weekStart: isoDate(start), weekEnd: isoDate(end) };
}

function statusTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" {
  switch (status) {
    case "approved":
      return "success";
    case "pending_approval":
      return "warning";
    case "draft":
      return "accent";
    default:
      return "neutral";
  }
}

export function PlannerPanel() {
  const students = useQuery(api.students.listForMyFamily);
  const createDraft = useMutation(api.schedules.createDraft);
  const requestApproval = useMutation(api.schedules.requestApproval);
  const approve = useMutation(api.schedules.approve);

  const [studentId, setStudentId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const selectedStudentId = (studentId || students?.[0]?._id || "") as
    | Id<"students">
    | "";

  const schedules = useQuery(
    api.schedules.listForStudent,
    selectedStudentId ? { studentId: selectedStudentId } : "skip",
  );

  async function createWeek(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) return;
    setMessage(null);
    const { weekStart, weekEnd } = weekRange();
    try {
      await createDraft({ studentId: selectedStudentId, weekStart, weekEnd });
      setMessage(`Draft schedule created for ${weekStart} → ${weekEnd}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  if (students === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (students.length === 0) {
    return (
      <EmptyState>Add a student to use the planner.</EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Section title="Weekly planner">
        <Card>
          <Select
            label="Student"
            value={selectedStudentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {students.map((s) => (
              <option key={s._id} value={s._id}>
                {s.displayName}
              </option>
            ))}
          </Select>

          <form onSubmit={(e) => void createWeek(e)} className="mt-4">
            <Button type="submit" variant="secondary" size="sm">
              Create draft for this week
            </Button>
          </form>
        </Card>
      </Section>

      <Message tone="success">{message}</Message>

      <Section title="Schedules">
        {schedules === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading schedules…</p>
        ) : schedules.length === 0 ? (
          <EmptyState>No schedules yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li key={s._id} className="list-row">
                <span className="text-sm text-[var(--foreground)]">
                  {s.weekStart} → {s.weekEnd}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  {s.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void requestApproval({ scheduleId: s._id }).catch(
                          (err) =>
                            setMessage(
                              err instanceof Error ? err.message : "Failed",
                            ),
                        )
                      }
                    >
                      Request approval
                    </Button>
                  )}
                  {s.status === "pending_approval" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void approve({ scheduleId: s._id }).catch((err) =>
                          setMessage(
                            err instanceof Error ? err.message : "Failed",
                          ),
                        )
                      }
                    >
                      Approve
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
