"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type EntryType = "native_completion" | "external_time" | "manual";

export function LogEntryForm() {
  const students = useQuery(api.students.listForMyFamily);
  const createLog = useMutation(api.logs.create);

  const [studentId, setStudentId] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("external_time");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedStudentId = (studentId || students?.[0]?._id || "") as
    | Id<"students">
    | "";

  const logs = useQuery(
    api.logs.listForStudent,
    selectedStudentId
      ? { studentId: selectedStudentId, limit: 10 }
      : "skip",
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedStudentId) {
      setError("Select a student first.");
      return;
    }

    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Enter a valid duration in minutes.");
      return;
    }

    setSaving(true);
    try {
      await createLog({
        studentId: selectedStudentId,
        entryType,
        durationMinutes: minutes,
        notes: notes.trim() || undefined,
      });
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create log");
    } finally {
      setSaving(false);
    }
  }

  if (students === undefined) {
    return <p className="text-sm text-neutral-500">Loading students…</p>;
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Add a student on the family dashboard before logging time.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <h2 className="text-lg font-medium text-neutral-900">Log entry</h2>

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

        <label className="block text-sm">
          <span className="text-neutral-600">Entry type</span>
          <select
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryType)}
          >
            <option value="external_time">External time</option>
            <option value="native_completion">Native completion</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-neutral-600">Duration (minutes)</span>
          <input
            type="number"
            min={1}
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-600">Notes</span>
          <textarea
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did they work on?"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save log"}
        </button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-800">
          Recent logs
        </h3>
        {logs === undefined ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-neutral-500">No logs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li
                key={log._id}
                className="border-b border-neutral-100 py-2 text-neutral-700"
              >
                <span className="font-medium">{log.durationMinutes} min</span>
                {" · "}
                <span>{log.entryType.replaceAll("_", " ")}</span>
                {log.notes ? ` — ${log.notes}` : ""}
                {log.verifiedByParent ? " ✓ verified" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
