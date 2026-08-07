"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function StudentDashboardPage() {
  const user = useQuery(api.users.current);
  const students = useQuery(api.students.listForMyFamily);

  if (user === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  const mine = students?.filter((s) => s.userId === user._id) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Student dashboard</h1>
      <p className="text-sm text-neutral-600">
        View your learning profile. Full student UX comes later.
      </p>
      {mine.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No linked student profile yet. A parent can link your account later.
        </p>
      ) : (
        <ul className="text-sm">
          {mine.map((s) => (
            <li key={s._id}>
              {s.displayName}
              {s.academicLevel ? ` · ${s.academicLevel}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
