"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Input,
  Textarea,
  Select,
  Section,
  Card,
  PageHeader,
  Badge,
  EmptyState,
  Message,
  Row,
  Col,
} from "@/components/ui";

type EntryType = "native_completion" | "external_time" | "manual";

export default function FamilyLedgerPage() {
  const students = useQuery(api.students.listForMyFamily);
  const courses = useQuery(api.courses.listAvailableForMyFamily);
  const subjects = useQuery(api.subjects.list);
  const createLog = useMutation(api.logs.create);
  const updateLog = useMutation(api.logs.update);
  const removeLog = useMutation(api.logs.remove);
  const verify = useMutation(api.logs.verify);
  const unverify = useMutation(api.logs.unverify);
  const generateUploadUrl = useMutation(api.logs.generateUploadUrl);

  const [studentId, setStudentId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("external_time");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editLogId, setEditLogId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);
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
      if (editLogId) {
        await updateLog({
          logId: editLogId as Id<"logs">,
          entryType,
          durationMinutes: minutes,
          notes: notes.trim() || undefined,
          courseId: courseId ? (courseId as Id<"courses">) : undefined,
          subjectId: subjectId ? (subjectId as Id<"subjects">) : undefined,
        });
        setEditLogId("");
        setNotes("");
        setMessage("Log updated.");
        return;
      }

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
      setMessage("Log saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save log");
    } finally {
      setSaving(false);
    }
  }

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
        title="Learning ledger"
        description="Log time and completions. Verify entries as a parent."
      />

      {students.length === 0 ? (
        <EmptyState>
          <Link href="/family/dashboard">
            <Button variant="secondary" size="sm">
              Add a student
            </Button>
          </Link>{" "}
          before logging time.
        </EmptyState>
      ) : (
        <>
          <Section title={editLogId ? "Edit log entry" : "New log entry"}>
            <Card>
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
                <Row gap="sm">
                  <Col span={12} md={6}>
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
                  </Col>
                  <Col span={12} md={6}>
                    <Select
                      label="Entry type"
                      value={entryType}
                      onChange={(e) =>
                        setEntryType(e.target.value as EntryType)
                      }
                    >
                      <option value="external_time">External time</option>
                      <option value="native_completion">Native completion</option>
                      <option value="manual">Manual</option>
                    </Select>
                  </Col>
                </Row>

                <Row gap="sm">
                  <Col span={12} md={6}>
                    <Select
                      label="Course (optional)"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                    >
                      <option value="">None</option>
                      {(courses ?? []).map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.title}
                        </option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={12} md={6}>
                    <Select
                      label="Subject (optional)"
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                    >
                      <option value="">None</option>
                      {(subjects ?? []).map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Col>
                </Row>

                <Input
                  label="Duration (minutes)"
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                />

                <Textarea
                  label="Notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did they work on?"
                />

                {!editLogId && (
                  <label className="block text-sm font-medium text-[var(--muted)]">
                    Attachment (optional)
                    <input
                      type="file"
                      className="mt-1.5 block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--accent)]"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}

                <Message tone="error">{error}</Message>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? "Saving…"
                      : editLogId
                        ? "Update log"
                        : "Save log"}
                  </Button>
                  {editLogId && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditLogId("");
                        setNotes("");
                        setDurationMinutes("30");
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </Section>

          <Section title="Recent logs">
            {logs === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : logs.length === 0 ? (
              <EmptyState>No logs yet.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li key={log._id} className="list-row">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-[var(--foreground)]">
                        {log.durationMinutes} min
                      </span>
                      <span className="text-[var(--muted)]">
                        {" · "}
                        {log.entryType.replaceAll("_", " ")}
                        {log.notes ? ` — ${log.notes}` : ""}
                        {log.storageId ? " · file attached" : ""}
                      </span>
                      {log.verifiedByParent && (
                        <Badge tone="success" className="ml-2">
                          verified
                        </Badge>
                      )}
                    </div>
                    <span className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditLogId(log._id);
                          setDurationMinutes(String(log.durationMinutes));
                          setNotes(log.notes ?? "");
                          setEntryType(log.entryType);
                          setCourseId(log.courseId ?? "");
                          setSubjectId(log.subjectId ?? "");
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm("Delete this log entry?")) return;
                          void removeLog({ logId: log._id }).catch((err) =>
                            setError(
                              err instanceof Error ? err.message : "Failed",
                            ),
                          );
                        }}
                      >
                        Delete
                      </Button>
                      {!log.verifiedByParent ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void verify({ logId: log._id }).catch((err) =>
                              setError(
                                err instanceof Error ? err.message : "Failed",
                              ),
                            )
                          }
                        >
                          Verify
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void unverify({ logId: log._id }).catch((err) =>
                              setError(
                                err instanceof Error ? err.message : "Failed",
                              ),
                            )
                          }
                        >
                          Unverify
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Message tone="success">{message}</Message>
    </div>
  );
}
