"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Message,
  Modal,
  PageHeader,
  Section,
  Select,
  Textarea,
} from "@/components/ui";

function currentTimeMs(): number {
  return Date.now();
}

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const typeLabels: Record<string, string> = {
  schedule_revision_requested: "Revision",
  log_created: "Log",
  log_verified: "Verified",
  schedule_approved: "Approved",
  schedule_item_added: "New item",
  course_assigned: "Course",
  assignment_new: "Assignment",
  chore_assigned: "Chore",
  chore_completed: "Chore done",
  reward_redeemed: "Reward",
  accolade_awarded: "Accolade",
  kudos_received: "Cheer",
  general: "General",
};

export default function AlertsPage() {
  const router = useRouter();
  const user = useQuery(api.users.current);
  const alerts = useQuery(api.alerts.listMine, { limit: 50 });
  const students = useQuery(api.students.listForMyFamily);
  const markRead = useMutation(api.alerts.markRead);
  const markAllRead = useMutation(api.alerts.markAllRead);
  const removeAlert = useMutation(api.alerts.remove);
  const createAlert = useMutation(api.alerts.create);
  const updateAlert = useMutation(api.alerts.update);

  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [studentId, setStudentId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"alerts"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [busy, setBusy] = useState(false);

  const role = user?.role ?? "parent";
  const canCreate = role === "parent" || role === "superAdmin";

  async function onOpen(alertId: Id<"alerts">, href?: string) {
    try {
      await markRead({ alertId, now: currentTimeMs() });
    } catch {
      // still navigate
    }
    if (href) {
      router.push(href);
    }
  }

  async function onMarkAll() {
    setError(null);
    try {
      await markAllRead({ now: currentTimeMs() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all read");
    }
  }

  async function onDismiss(alertId: Id<"alerts">) {
    setError(null);
    try {
      await removeAlert({ alertId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setBusy(true);
    try {
      if (studentId) {
        await createAlert({
          recipientType: "student",
          studentId: studentId as Id<"students">,
          type: "general",
          title: title.trim(),
          body: body.trim(),
          href: "/alerts",
        });
      } else {
        await createAlert({
          recipientType: "family",
          type: "general",
          title: title.trim(),
          body: body.trim(),
          href: "/alerts",
        });
      }
      setTitle("");
      setBody("");
      setStudentId("");
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setError(null);
    setBusy(true);
    try {
      await updateAlert({
        alertId: editId,
        title: editTitle.trim(),
        body: editBody.trim(),
      });
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined || alerts === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading alerts…</p>;
  }

  if (user === null) {
    return (
      <p className="text-sm text-[var(--muted)]">
        <Link href="/sign-in" className="hover-link font-medium text-[var(--accent)] underline-offset-2">
          Sign in
        </Link>{" "}
        to view alerts.
      </p>
    );
  }

  const unread = alerts.filter((a) => a.readAt === undefined).length;

  return (
    <div className="page-stack">
      <PageHeader
        compact
        title="Alerts"
        description={
          role === "student"
            ? "Assignments, schedule updates, and notes."
            : "Family activity and reminders."
        }
        actions={
          <>
            {unread > 0 && (
              <Button variant="secondary" size="sm" onClick={() => void onMarkAll()}>
                Mark all read
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Send alert
              </Button>
            )}
          </>
        }
      />

      {unread > 0 && (
        <Badge tone="warning">{unread} unread</Badge>
      )}

      <Message tone="error">{error}</Message>

      <Section>
        {alerts.length === 0 ? (
          <EmptyState>No alerts yet.</EmptyState>
        ) : (
          <div className="space-y-1">
            {alerts.map((alert) => {
              const unreadItem = alert.readAt === undefined;
              return (
                <div
                  key={alert._id}
                  className={`list-row list-row-dense ${unreadItem ? "border-[var(--warning)]/25 bg-[var(--warning-soft)]" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">
                        {typeLabels[alert.type] ?? alert.type}
                      </Badge>
                      {unreadItem && <Badge tone="warning">Unread</Badge>}
                      <span className="text-xs text-[var(--muted-fg)]">
                        {formatWhen(alert.createdAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onOpen(alert._id, alert.href)}
                      className="hover-fade mt-1 text-left text-sm font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)]"
                    >
                      {alert.title}
                    </button>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">
                      {alert.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {unreadItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void markRead({
                            alertId: alert._id,
                            now: currentTimeMs(),
                          })
                        }
                      >
                        Read
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditId(alert._id);
                        setEditTitle(alert.title);
                        setEditBody(alert.body);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void onDismiss(alert._id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Send an alert"
        description="Notify the whole family or a specific student."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-alert-form" disabled={busy}>
              {busy ? "Sending…" : "Create alert"}
            </Button>
          </>
        }
      >
        <form id="create-alert-form" onSubmit={(e) => void onCreate(e)} className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Select
            label="Recipient"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Whole family</option>
            {(students ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.displayName}
              </option>
            ))}
          </Select>
          <Textarea
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
          />
        </form>
      </Modal>

      <Modal
        open={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit alert"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditId(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-alert-form" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="edit-alert-form" onSubmit={(e) => void onSaveEdit(e)} className="space-y-4">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
          <Textarea
            label="Message"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            required
          />
        </form>
      </Modal>
    </div>
  );
}
