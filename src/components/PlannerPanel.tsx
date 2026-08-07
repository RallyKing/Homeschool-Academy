"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Add a student to use the planner.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-neutral-900">Weekly planner</h2>

      <label className="block text-sm">
        <span className="text-neutral-600">Student</span>
        <select
          className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
          value={selectedStudentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s._id} value={s._id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </label>

      <form onSubmit={(e) => void createWeek(e)}>
        <button
          type="submit"
          className="border border-neutral-400 px-3 py-1.5 text-sm"
        >
          Create draft for this week
        </button>
      </form>

      {message && <p className="text-sm text-neutral-600">{message}</p>}

      <ul className="space-y-2 text-sm">
        {schedules === undefined ? (
          <li className="text-neutral-500">Loading schedules…</li>
        ) : schedules.length === 0 ? (
          <li className="text-neutral-500">No schedules yet.</li>
        ) : (
          schedules.map((s) => (
            <li
              key={s._id}
              className="flex flex-wrap items-center gap-2 border-b border-neutral-100 py-2"
            >
              <span>
                {s.weekStart} → {s.weekEnd}
              </span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase tracking-wide text-neutral-700">
                {s.status}
              </span>
              {s.status === "draft" && (
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    void requestApproval({ scheduleId: s._id }).catch((err) =>
                      setMessage(
                        err instanceof Error ? err.message : "Failed",
                      ),
                    )
                  }
                >
                  Request approval
                </button>
              )}
              {s.status === "pending_approval" && (
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    void approve({ scheduleId: s._id }).catch((err) =>
                      setMessage(
                        err instanceof Error ? err.message : "Failed",
                      ),
                    )
                  }
                >
                  Approve
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
