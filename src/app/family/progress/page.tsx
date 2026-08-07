"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function FamilyProgressPage() {
  const students = useQuery(api.students.listForMyFamily);
  const [studentId, setStudentId] = useState("");

  const selectedStudentId = (studentId || students?.[0]?._id || "") as
    | Id<"students">
    | "";

  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const progress = useQuery(
    api.logs.progressSummary,
    selectedStudentId
      ? { studentId: selectedStudentId, since }
      : "skip",
  );

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
          Last 30 days of logged learning per student.
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
        <>
          <label className="block text-sm">
            Student
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

          {progress === undefined ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-neutral-500">Total minutes</dt>
                  <dd className="text-xl font-semibold">
                    {progress.totalMinutes}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Verified minutes</dt>
                  <dd className="text-xl font-semibold">
                    {progress.verifiedMinutes}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Entries</dt>
                  <dd className="text-xl font-semibold">
                    {progress.entryCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Verified entries</dt>
                  <dd className="text-xl font-semibold">
                    {progress.verifiedCount}
                  </dd>
                </div>
              </dl>

              <div className="text-sm">
                <h2 className="mb-1 font-medium">By type</h2>
                <ul className="space-y-1 text-neutral-700">
                  <li>External: {progress.byEntryType.external_time} min</li>
                  <li>Native: {progress.byEntryType.native_completion} min</li>
                  <li>Manual: {progress.byEntryType.manual} min</li>
                </ul>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-medium">Recent activity</h2>
                <ul className="space-y-2 text-sm">
                  {progress.recent.length === 0 ? (
                    <li className="text-neutral-500">No activity yet.</li>
                  ) : (
                    progress.recent.map((log) => (
                      <li
                        key={log._id}
                        className="border-b border-neutral-100 py-2"
                      >
                        {log.durationMinutes} min ·{" "}
                        {log.entryType.replaceAll("_", " ")}
                        {log.notes ? ` — ${log.notes}` : ""}
                        {log.verifiedByParent ? " ✓" : ""}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
