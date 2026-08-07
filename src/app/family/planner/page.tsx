"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Input,
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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { weekStart: isoDate(start), weekEnd: isoDate(end) };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" {
  switch (status) {
    case "approved":
      return "success";
    case "pending_approval":
      return "warning";
    case "draft":
      return "accent";
    default:
      return "neutral";
  }
}

export default function FamilyPlannerPage() {
  const students = useQuery(api.students.listForMyFamily);
  const courses = useQuery(api.courses.listAvailableForMyFamily);
  const createDraft = useMutation(api.schedules.createDraft);
  const updateSchedule = useMutation(api.schedules.update);
  const removeSchedule = useMutation(api.schedules.remove);
  const requestApproval = useMutation(api.schedules.requestApproval);
  const approve = useMutation(api.schedules.approve);
  const requestRevision = useMutation(api.schedules.requestRevision);
  const addItem = useMutation(api.schedules.addItem);
  const updateItem = useMutation(api.schedules.updateItem);
  const removeItem = useMutation(api.schedules.removeItem);

  const [studentId, setStudentId] = useState("");
  const [activeSchedule, setActiveSchedule] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemMinutes, setItemMinutes] = useState("45");
  const [itemDay, setItemDay] = useState("1");
  const [itemCourse, setItemCourse] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const selectedStudentId = (studentId || students?.[0]?._id || "") as
    | Id<"students">
    | "";

  const schedules = useQuery(
    api.schedules.listForStudent,
    selectedStudentId ? { studentId: selectedStudentId } : "skip",
  );

  const scheduleId = (activeSchedule || schedules?.[0]?._id || "") as
    | Id<"schedules">
    | "";

  const items = useQuery(
    api.schedules.listItems,
    scheduleId ? { scheduleId } : "skip",
  );

  const active = schedules?.find((s) => s._id === scheduleId);

  async function createWeek(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) return;
    setMessage(null);
    const { weekStart, weekEnd } = weekRange();
    try {
      const id = await createDraft({
        studentId: selectedStudentId,
        weekStart,
        weekEnd,
      });
      setActiveSchedule(id);
      setMessage(`Draft created for ${weekStart} → ${weekEnd}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    if (!scheduleId || !itemTitle.trim()) return;
    try {
      if (editItemId) {
        await updateItem({
          itemId: editItemId as Id<"scheduleItems">,
          title: itemTitle.trim(),
          plannedMinutes: Number(itemMinutes) || 30,
          dayOfWeek: Number(itemDay),
          courseId: itemCourse
            ? (itemCourse as Id<"courses">)
            : undefined,
        });
        setEditItemId("");
        setItemTitle("");
        setMessage("Item updated.");
        return;
      }
      await addItem({
        scheduleId,
        title: itemTitle.trim(),
        plannedMinutes: Number(itemMinutes) || 30,
        dayOfWeek: Number(itemDay),
        courseId: itemCourse
          ? (itemCourse as Id<"courses">)
          : undefined,
      });
      setItemTitle("");
      setMessage("Item added.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
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
        title="Weekly planner"
        description="Draft → request approval → approve. Students can request revision."
      />

      {students.length === 0 ? (
        <EmptyState>
          <Link href="/family/dashboard">
            <Button variant="secondary" size="sm">
              Add a student
            </Button>
          </Link>{" "}
          to start planning.
        </EmptyState>
      ) : (
        <>
          <Card>
            <Row gap="sm">
              <Col span={12} md={6}>
                <Select
                  label="Student"
                  value={selectedStudentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    setActiveSchedule("");
                  }}
                >
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.displayName}
                    </option>
                  ))}
                </Select>
              </Col>
              <Col span={12} md={6} className="flex items-end">
                <form onSubmit={(e) => void createWeek(e)} className="w-full">
                  <Button type="submit" className="w-full md:w-auto">
                    Create draft for this week
                  </Button>
                </form>
              </Col>
            </Row>
          </Card>

          <Section title="Schedules">
            {schedules === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : schedules.length === 0 ? (
              <EmptyState>No schedules yet — create a draft above.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {schedules.map((s) => (
                  <li key={s._id} className="list-row">
                    <button
                      type="button"
                      className={`text-sm ${scheduleId === s._id ? "font-semibold text-[var(--accent)]" : "text-[var(--foreground)]"}`}
                      onClick={() => setActiveSchedule(s._id)}
                    >
                      {s.weekStart} → {s.weekEnd}
                    </button>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                      {s.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void requestApproval({ scheduleId: s._id }).catch(
                              (err) =>
                                setMessage(
                                  err instanceof Error ? err.message : "Failed",
                                ),
                            )
                          }
                        >
                          Request approval
                        </Button>
                      )}
                      {s.status === "pending_approval" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void approve({ scheduleId: s._id }).catch((err) =>
                              setMessage(
                                err instanceof Error ? err.message : "Failed",
                              ),
                            )
                          }
                        >
                          Approve
                        </Button>
                      )}
                      {(s.status === "approved" ||
                        s.status === "pending_approval") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void requestRevision({ scheduleId: s._id }).catch(
                              (err) =>
                                setMessage(
                                  err instanceof Error ? err.message : "Failed",
                                ),
                            )
                          }
                        >
                          Request revision
                        </Button>
                      )}
                      {s.status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const start = window.prompt(
                              "Week start (YYYY-MM-DD)",
                              s.weekStart,
                            );
                            if (!start) return;
                            const end = window.prompt(
                              "Week end (YYYY-MM-DD)",
                              s.weekEnd,
                            );
                            if (!end) return;
                            void updateSchedule({
                              scheduleId: s._id,
                              weekStart: start,
                              weekEnd: end,
                            })
                              .then(() => setMessage("Schedule dates updated."))
                              .catch((err) =>
                                setMessage(
                                  err instanceof Error ? err.message : "Failed",
                                ),
                              );
                          }}
                        >
                          Edit dates
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Delete this schedule and all its items?",
                            )
                          ) {
                            return;
                          }
                          void removeSchedule({ scheduleId: s._id })
                            .then(() => {
                              if (activeSchedule === s._id) setActiveSchedule("");
                              setMessage("Schedule deleted.");
                            })
                            .catch((err) =>
                              setMessage(
                                err instanceof Error ? err.message : "Failed",
                              ),
                            );
                        }}
                      >
                        Delete
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {scheduleId && active && active.status !== "approved" && (
            <Section
              title={editItemId ? "Edit schedule item" : "Add schedule item"}
            >
              <Card>
                <form onSubmit={(e) => void onAddItem(e)} className="space-y-4">
                  <Input
                    label="Title"
                    placeholder="Activity title"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    required
                  />
                  <Row gap="sm">
                    <Col span={12} md={4}>
                      <Input
                        label="Minutes"
                        type="number"
                        min={1}
                        value={itemMinutes}
                        onChange={(e) => setItemMinutes(e.target.value)}
                      />
                    </Col>
                    <Col span={12} md={4}>
                      <Select
                        label="Day"
                        value={itemDay}
                        onChange={(e) => setItemDay(e.target.value)}
                      >
                        {DAYS.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={12} md={4}>
                      <Select
                        label="Course"
                        value={itemCourse}
                        onChange={(e) => setItemCourse(e.target.value)}
                      >
                        <option value="">No course</option>
                        {(courses ?? []).map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.title}
                          </option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                  <div className="flex gap-2">
                    <Button type="submit" variant="secondary">
                      {editItemId ? "Save item" : "Add item"}
                    </Button>
                    {editItemId && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditItemId("");
                          setItemTitle("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Card>
            </Section>
          )}

          {scheduleId && (
            <Section title="Items">
              {items === undefined ? (
                <p className="text-sm text-[var(--muted)]">Loading…</p>
              ) : items.length === 0 ? (
                <EmptyState>No items yet.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item._id} className="list-row">
                      <span className="text-sm text-[var(--foreground)]">
                        {item.dayOfWeek !== undefined
                          ? `${DAYS[item.dayOfWeek]} · `
                          : ""}
                        {item.title} · {item.plannedMinutes} min
                      </span>
                      {active?.status !== "approved" && (
                        <span className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditItemId(item._id);
                              setItemTitle(item.title);
                              setItemMinutes(String(item.plannedMinutes));
                              setItemDay(
                                item.dayOfWeek !== undefined
                                  ? String(item.dayOfWeek)
                                  : "1",
                              );
                              setItemCourse(item.courseId ?? "");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              void removeItem({ itemId: item._id }).catch(
                                (err) =>
                                  setMessage(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed",
                                  ),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </>
      )}

      <Message tone="success">{message}</Message>
    </div>
  );
}
