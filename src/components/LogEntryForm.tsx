"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Button,
  Input,
  Textarea,
  Select,
  Section,
  Card,
  Badge,
  EmptyState,
  Message,
} from "@/components/ui";

type EntryType = "native_completion" | "external_time" | "manual";

export function LogEntryForm() {
  const students = useQuery(api.students.listForMyFamily);
  const createLog = useMutation(api.logs.create);

  const [studentId, setStudentId] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("external_time");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      await createLog({
        studentId: selectedStudentId,
        entryType,
        durationMinutes: minutes,
        notes: notes.trim() || undefined,
      });
      setNotes("");
      setMessage("Log saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create log");
    } finally {
      setSaving(false);
    }
  }

  if (students === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading students…</p>;
  }

  if (students.length === 0) {
    return (
      <EmptyState>
        Add a student on the family dashboard before logging time.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Log entry">
        <Card>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
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

            <Select
              label="Entry type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as EntryType)}
            >
              <option value="external_time">External time</option>
              <option value="native_completion">Native completion</option>
              <option value="manual">Manual</option>
            </Select>

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

            <Message tone="error">{error}</Message>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save log"}
            </Button>
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
              <li key={log._id} className="list-row text-sm">
                <span className="text-[var(--foreground)]">
                  <span className="font-medium">{log.durationMinutes} min</span>
                  {" · "}
                  {log.entryType.replaceAll("_", " ")}
                  {log.notes ? ` — ${log.notes}` : ""}
                </span>
                {log.verifiedByParent && (
                  <Badge tone="success">verified</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Message tone="success">{message}</Message>
    </div>
  );
}
