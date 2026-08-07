"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LogEntryForm } from "@/components/LogEntryForm";
import { PlannerPanel } from "@/components/PlannerPanel";
import { api } from "../../../../convex/_generated/api";

export default function FamilyDashboardPage() {
  const user = useQuery(api.users.current);
  const family = useQuery(api.users.myFamily);
  const students = useQuery(api.students.listForMyFamily);
  const ensureFamily = useMutation(api.families.ensureMine);
  const createStudent = useMutation(api.students.create);
  const seedSubjects = useMutation(api.subjects.seed);

  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (user === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  async function setupFamily() {
    setMessage(null);
    try {
      await ensureFamily({});
      setMessage("Family ready.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAddStudent(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMessage(null);
    try {
      if (!family) {
        await ensureFamily({});
      }
      await createStudent({ displayName: name.trim() });
      setName("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Family dashboard</h1>
        <p className="text-sm text-neutral-600">
          {family ? family.name : "No family yet — create one to manage students."}
        </p>
        {!family && (
          <button
            type="button"
            onClick={() => void setupFamily()}
            className="mt-2 border border-neutral-400 px-3 py-1.5 text-sm"
          >
            Create family
          </button>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Students</h2>
        <ul className="text-sm text-neutral-700">
          {students === undefined ? (
            <li>Loading…</li>
          ) : students.length === 0 ? (
            <li>No students yet.</li>
          ) : (
            students.map((s) => (
              <li key={s._id} className="border-b border-neutral-100 py-1">
                {s.displayName}
                {s.academicLevel ? ` · ${s.academicLevel}` : ""}
              </li>
            ))
          )}
        </ul>
        <form onSubmit={(e) => void onAddStudent(e)} className="flex gap-2">
          <input
            className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
            placeholder="Student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Add
          </button>
        </form>
      </section>

      <LogEntryForm />
      <PlannerPanel />

      <section>
        <button
          type="button"
          className="text-sm underline text-neutral-600"
          onClick={() =>
            void seedSubjects()
              .then((r) =>
                setMessage(`Subjects seeded: ${r.created}/${r.total} new`),
              )
              .catch((err) =>
                setMessage(err instanceof Error ? err.message : "Failed"),
              )
          }
        >
          Seed subject taxonomy
        </button>
      </section>

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
