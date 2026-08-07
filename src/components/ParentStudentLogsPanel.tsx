"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Message,
  Modal,
  Section,
  Select,
  Textarea,
  Row,
  Col,
} from "@/components/ui";

type EntryType = "native_completion" | "external_time" | "manual";

function isNullified(status: string | undefined): boolean {
  return status === "nullified";
}

export function ParentStudentLogsPanel({
  studentId,
  showCreate = true,
  limit = 40,
  title = "Learning logs",
}: {
  studentId: Id<"students">;
  showCreate?: boolean;
  limit?: number;
  title?: string;
}) {
  const courses = useQuery(api.courses.listAvailableForMyFamily);
  const subjects = useQuery(api.subjects.list);
  const createLog = useMutation(api.logs.create);
  const updateLog = useMutation(api.logs.update);
  const removeLog = useMutation(api.logs.remove);
  const nullifyLog = useMutation(api.logs.nullify);
  const restoreLog = useMutation(api.logs.restore);
  const verify = useMutation(api.logs.verify);
  const unverify = useMutation(api.logs.unverify);
  const generateUploadUrl = useMutation(api.logs.generateUploadUrl);

  const logs = useQuery(api.logs.listForStudent, {
    studentId,
    limit,
  });

  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("external_time");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editLogId, setEditLogId] = useState<Id<"logs"> | null>(null);
  const [editDuration, setEditDuration] = useState("30");
  const [editNotes, setEditNotes] = useState("");
  const [editEntryType, setEditEntryType] = useState<EntryType>("external_time");
  const [editCourseId, setEditCourseId] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);

  const [nullifyLogId, setNullifyLogId] = useState<Id<"logs"> | null>(null);
  const [nullifyReason, setNullifyReason] = useState("");

  async function uploadAttachment(
    selected: File | null,
  ): Promise<Id<"_storage"> | undefined> {
    if (!selected) return undefined;
    const uploadUrl = await generateUploadUrl({});
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": selected.type || "application/octet-stream" },
      body: selected,
    });
    if (!result.ok) {
      throw new Error("File upload failed");
    }
    const json = (await result.json()) as { storageId: Id<"_storage"> };
    return json.storageId;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Enter a valid duration in minutes.");
      return;
    }
    setSaving(true);
    try {
      const storageId = await uploadAttachment(file);
      await createLog({
        studentId,
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

  function openEdit(log: {
    _id: Id<"logs">;
    durationMinutes: number;
    notes?: string;
    entryType: EntryType;
    courseId?: Id<"courses">;
    subjectId?: Id<"subjects">;
  }) {
    setEditLogId(log._id);
    setEditDuration(String(log.durationMinutes));
    setEditNotes(log.notes ?? "");
    setEditEntryType(log.entryType);
    setEditCourseId(log.courseId ?? "");
    setEditSubjectId(log.subjectId ?? "");
    setEditFile(null);
    setError(null);
  }

  async function onSaveEdit() {
    if (!editLogId) return;
    setError(null);
    setMessage(null);
    const minutes = Number(editDuration);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Enter a valid duration in minutes.");
      return;
    }
    setSaving(true);
    try {
      const storageId = await uploadAttachment(editFile);
      await updateLog({
        logId: editLogId,
        entryType: editEntryType,
        durationMinutes: minutes,
        notes: editNotes.trim() || undefined,
        courseId: editCourseId ? (editCourseId as Id<"courses">) : undefined,
        subjectId: editSubjectId
          ? (editSubjectId as Id<"subjects">)
          : undefined,
        ...(storageId ? { storageId } : {}),
      });
      setEditLogId(null);
      setMessage("Log updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update log");
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmNullify() {
    if (!nullifyLogId) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await nullifyLog({
        logId: nullifyLogId,
        reason: nullifyReason.trim() || undefined,
      });
      setNullifyLogId(null);
      setNullifyReason("");
      setMessage(
        "Log nullified. It stays for audit but is excluded from progress totals. XP already awarded is not reversed.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to nullify log");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {showCreate ? (
        <Section title="New log entry">
          <Card>
            <form onSubmit={(e) => void onCreate(e)} className="space-y-4">
              <Row gap="sm">
                <Col span={12} md={6}>
                  <Select
                    label="Entry type"
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as EntryType)}
                  >
                    <option value="external_time">External time</option>
                    <option value="native_completion">Native completion</option>
                    <option value="manual">Manual</option>
                  </Select>
                </Col>
                <Col span={12} md={6}>
                  <Input
                    label="Duration (minutes)"
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    required
                  />
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
              <Textarea
                label="Notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did they work on?"
              />
              <label className="block text-sm font-medium text-[var(--muted)]">
                Attachment (optional)
                <input
                  type="file"
                  className="mt-1.5 block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--accent)]"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save log"}
              </Button>
            </form>
          </Card>
        </Section>
      ) : null}

      <Section
        title={title}
        description="Parents can edit, nullify, restore, or permanently delete any log for this student."
      >
        {logs === undefined ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : logs.length === 0 ? (
          <EmptyState>No logs yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => {
              const voided = isNullified(log.status);
              return (
                <li
                  key={log._id}
                  className={`list-row ${voided ? "opacity-70" : ""}`}
                >
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
                    {voided ? (
                      <Badge tone="warning" className="ml-2">
                        nullified
                      </Badge>
                    ) : null}
                    {!voided && log.verifiedByParent ? (
                      <Badge tone="success" className="ml-2">
                        verified
                      </Badge>
                    ) : null}
                    {voided && log.nullifyReason ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Reason: {log.nullifyReason}
                      </p>
                    ) : null}
                  </div>
                  <span className="flex flex-wrap gap-2">
                    {!voided ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(log)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setNullifyLogId(log._id);
                            setNullifyReason("");
                            setError(null);
                          }}
                        >
                          Nullify
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Permanently delete this log? Prefer Nullify to keep an audit trail.",
                              )
                            ) {
                              return;
                            }
                            void removeLog({ logId: log._id })
                              .then(() => setMessage("Log deleted."))
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
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
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
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
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                ),
                              )
                            }
                          >
                            Unverify
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void restoreLog({ logId: log._id })
                              .then(() =>
                                setMessage("Log restored to active."),
                              )
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                ),
                              )
                          }
                        >
                          Restore
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Permanently delete this nullified log?",
                              )
                            ) {
                              return;
                            }
                            void removeLog({ logId: log._id })
                              .then(() => setMessage("Log deleted."))
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                ),
                              );
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Message tone="error">{error}</Message>
      <Message tone="success">{message}</Message>

      <Modal
        open={editLogId !== null}
        onClose={() => setEditLogId(null)}
        title="Edit log entry"
        description="Correct duration, notes, course, subject, or attachment."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditLogId(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void onSaveEdit()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <Select
          label="Entry type"
          value={editEntryType}
          onChange={(e) => setEditEntryType(e.target.value as EntryType)}
        >
          <option value="external_time">External time</option>
          <option value="native_completion">Native completion</option>
          <option value="manual">Manual</option>
        </Select>
        <Select
          label="Course (optional)"
          value={editCourseId}
          onChange={(e) => setEditCourseId(e.target.value)}
        >
          <option value="">None</option>
          {(courses ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.title}
            </option>
          ))}
        </Select>
        <Select
          label="Subject (optional)"
          value={editSubjectId}
          onChange={(e) => setEditSubjectId(e.target.value)}
        >
          <option value="">None</option>
          {(subjects ?? []).map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input
          label="Duration (minutes)"
          type="number"
          min={1}
          value={editDuration}
          onChange={(e) => setEditDuration(e.target.value)}
          required
        />
        <Textarea
          label="Notes"
          rows={3}
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
        />
        <label className="block text-sm font-medium text-[var(--muted)]">
          Replace attachment (optional)
          <input
            type="file"
            className="mt-1.5 block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--accent)]"
            onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Modal>

      <Modal
        open={nullifyLogId !== null}
        onClose={() => {
          setNullifyLogId(null);
          setNullifyReason("");
        }}
        title="Nullify log"
        description="Soft-void this entry. It remains visible for audit but is excluded from progress charts. XP already earned is not reversed."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setNullifyLogId(null);
                setNullifyReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={saving}
              onClick={() => void onConfirmNullify()}
            >
              {saving ? "Nullifying…" : "Nullify"}
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          rows={3}
          value={nullifyReason}
          onChange={(e) => setNullifyReason(e.target.value)}
          placeholder="e.g. Student entered wrong duration"
        />
      </Modal>
    </div>
  );
}
