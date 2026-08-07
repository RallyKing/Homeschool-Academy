"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
    return <p className="text-sm text-neutral-500">Loading alerts…</p>;
  }

  if (user === null) {
    return (
      <p className="text-sm text-neutral-600">
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>{" "}
        to view alerts.
      </p>
    );
  }

  const unread = alerts.filter((a) => a.readAt === undefined).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {role === "student"
              ? "New assignments, schedule updates, and notes for you."
              : "Family activity: student requests, completions, and reminders."}
            {unread > 0 ? ` · ${unread} unread` : ""}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => void onMarkAll()}
            className="text-sm text-neutral-700 underline hover:text-neutral-900"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {canCreate && (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="space-y-3 border-t border-neutral-200 pt-6"
        >
          <h2 className="text-sm font-medium text-neutral-800">Send an alert</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Whole family</option>
              {(students ?? []).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            rows={2}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Create alert
          </button>
        </form>
      )}

      <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
        {alerts.length === 0 && (
          <li className="py-8 text-sm text-neutral-500">No alerts yet.</li>
        )}
        {alerts.map((alert) => {
          const unreadItem = alert.readAt === undefined;
          return (
            <li
              key={alert._id}
              className={`flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between ${
                unreadItem ? "bg-amber-50/40" : ""
              }`}
            >
              {editId === alert._id ? (
                <form
                  onSubmit={(e) => void onSaveEdit(e)}
                  className="w-full space-y-2"
                >
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-3 text-sm">
                    <button
                      type="submit"
                      disabled={busy}
                      className="text-neutral-900 underline"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="text-neutral-500 underline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-neutral-500">
                        {typeLabels[alert.type] ?? alert.type}
                      </span>
                      {unreadItem && (
                        <span className="text-xs font-medium text-amber-800">
                          Unread
                        </span>
                      )}
                      <span className="text-xs text-neutral-400">
                        {formatWhen(alert.createdAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onOpen(alert._id, alert.href)}
                      className="mt-1 text-left font-medium text-neutral-900 hover:underline"
                    >
                      {alert.title}
                    </button>
                    <p className="mt-0.5 text-sm text-neutral-600">{alert.body}</p>
                    {alert.href && (
                      <Link
                        href={alert.href}
                        onClick={() =>
                          void markRead({
                            alertId: alert._id,
                            now: currentTimeMs(),
                          })
                        }
                        className="mt-1 inline-block text-sm text-neutral-700 underline"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm">
                    {unreadItem && (
                      <button
                        type="button"
                        onClick={() =>
                          void markRead({
                            alertId: alert._id,
                            now: currentTimeMs(),
                          })
                        }
                        className="text-neutral-600 underline"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(alert._id);
                        setEditTitle(alert.title);
                        setEditBody(alert.body);
                      }}
                      className="text-neutral-600 underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDismiss(alert._id)}
                      className="text-neutral-600 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
