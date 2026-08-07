"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type EntryType = "native_completion" | "external_time" | "manual";

export default function FamilyLedgerPage() {
  const students = useQuery(api.students.listForMyFamily);
  const courses = useQuery(api.courses.listAvailableForMyFamily);
  const subjects = useQuery(api.subjects.list);
  const createLog = useMutation(api.logs.create);
  const verify = useMutation(api.logs.verify);
  const generateUploadUrl = useMutation(api.logs.generateUploadUrl);

  const [studentId, setStudentId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("external_time");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedStudentId = (studentId || students?.[0]?._id || "") as
    | Id<"students">
    | "";

  const logs = useQuery(
    api.logs.listForStudent,
    selectedStudentId
      ? { studentId: selectedStudentId, limit: 30 }
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
      let storageId: Id<"_storage"> | undefined;
      if (file) {
        const uploadUrl = await generateUploadUrl({});
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!result.ok) {
          throw new Error("File upload failed");
        }
        const json = (await result.json()) as { storageId: Id<"_storage"> };
        storageId = json.storageId;
      }

      await createLog({
        studentId: selectedStudentId,
        entryType,
        durationMinutes: minutes,
        notes: notes.trim() || undefined,
        courseId: courseId ? (courseId as Id<"courses">) : undefined,
        subjectId: subjectId ? (subjectId as Id<"subjects">) : undefined,
        storageId,
      });
      setNotes("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create log");
    } finally {
      setSaving(false);
    }
  }

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
        <h1 className="mt-2 text-2xl font-semibold">Learning ledger</h1>
        <p className="text-sm text-neutral-600">
          Log time and completions. Verify entries as a parent.
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
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
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

            <label className="block text-sm">
              Entry type
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
              Course (optional)
              <select
                className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">None</option>
                {(courses ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Subject (optional)
              <select
                className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">None</option>
                {(subjects ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Duration (minutes)
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
              Notes
              <textarea
                className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did they work on?"
              />
            </label>

            <label className="block text-sm">
              Attachment (optional)
              <input
                type="file"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
            <h2 className="mb-2 text-lg font-medium">Recent logs</h2>
            {logs === undefined ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-neutral-500">No logs yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {logs.map((log) => (
                  <li
                    key={log._id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2"
                  >
                    <span>
                      <span className="font-medium">
                        {log.durationMinutes} min
                      </span>
                      {" · "}
                      {log.entryType.replaceAll("_", " ")}
                      {log.notes ? ` — ${log.notes}` : ""}
                      {log.storageId ? " · file attached" : ""}
                      {log.verifiedByParent ? " · verified" : ""}
                    </span>
                    {!log.verifiedByParent && (
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() =>
                          void verify({ logId: log._id }).catch((err) =>
                            setError(
                              err instanceof Error ? err.message : "Failed",
                            ),
                          )
                        }
                      >
                        Verify
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
