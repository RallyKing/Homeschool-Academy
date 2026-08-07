"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

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

export default function FamilyPlannerPage() {
  const students = useQuery(api.students.listForMyFamily);
  const courses = useQuery(api.courses.listAvailableForMyFamily);
  const createDraft = useMutation(api.schedules.createDraft);
  const requestApproval = useMutation(api.schedules.requestApproval);
  const approve = useMutation(api.schedules.approve);
  const requestRevision = useMutation(api.schedules.requestRevision);
  const addItem = useMutation(api.schedules.addItem);
  const removeItem = useMutation(api.schedules.removeItem);

  const [studentId, setStudentId] = useState("");
  const [activeSchedule, setActiveSchedule] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemMinutes, setItemMinutes] = useState("45");
  const [itemDay, setItemDay] = useState("1");
  const [itemCourse, setItemCourse] = useState("");
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
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
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
        <h1 className="mt-2 text-2xl font-semibold">Weekly planner</h1>
        <p className="text-sm text-neutral-600">
          Draft → request approval → approve. Students can request revision.
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
          <label className="block text-sm">
            Student
            <select
              className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
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
            </select>
          </label>

          <form onSubmit={(e) => void createWeek(e)}>
            <button
              type="submit"
              className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
            >
              Create draft for this week
            </button>
          </form>

          <ul className="space-y-2 text-sm">
            {schedules === undefined ? (
              <li>Loading…</li>
            ) : schedules.length === 0 ? (
              <li className="text-neutral-500">No schedules yet.</li>
            ) : (
              schedules.map((s) => (
                <li
                  key={s._id}
                  className="flex flex-wrap items-center gap-2 border-b border-neutral-100 py-2"
                >
                  <button
                    type="button"
                    className={
                      scheduleId === s._id ? "font-medium underline" : ""
                    }
                    onClick={() => setActiveSchedule(s._id)}
                  >
                    {s.weekStart} → {s.weekEnd}
                  </button>
                  <span className="bg-neutral-100 px-1.5 py-0.5 text-xs uppercase tracking-wide">
                    {s.status}
                  </span>
                  {s.status === "draft" && (
                    <button
                      type="button"
                      className="text-xs underline"
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
                    </button>
                  )}
                  {s.status === "pending_approval" && (
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() =>
                        void approve({ scheduleId: s._id }).catch((err) =>
                          setMessage(
                            err instanceof Error ? err.message : "Failed",
                          ),
                        )
                      }
                    >
                      Approve
                    </button>
                  )}
                  {(s.status === "approved" ||
                    s.status === "pending_approval") && (
                    <button
                      type="button"
                      className="text-xs underline"
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
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>

          {scheduleId && active && active.status !== "approved" && (
            <form
              onSubmit={(e) => void onAddItem(e)}
              className="space-y-2 border-t border-neutral-200 pt-4"
            >
              <h2 className="text-lg font-medium">Add schedule item</h2>
              <input
                className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
                placeholder="Title"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                required
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min={1}
                  className="border border-neutral-300 px-2 py-1.5 text-sm sm:w-28"
                  value={itemMinutes}
                  onChange={(e) => setItemMinutes(e.target.value)}
                />
                <select
                  className="border border-neutral-300 px-2 py-1.5 text-sm"
                  value={itemDay}
                  onChange={(e) => setItemDay(e.target.value)}
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  className="flex-1 border border-neutral-300 px-2 py-1.5 text-sm"
                  value={itemCourse}
                  onChange={(e) => setItemCourse(e.target.value)}
                >
                  <option value="">No course</option>
                  {(courses ?? []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="border border-neutral-400 px-3 py-1.5 text-sm"
              >
                Add item
              </button>
            </form>
          )}

          {scheduleId && (
            <section className="space-y-2">
              <h2 className="text-lg font-medium">Items</h2>
              <ul className="text-sm">
                {items === undefined ? (
                  <li>Loading…</li>
                ) : items.length === 0 ? (
                  <li className="text-neutral-500">No items yet.</li>
                ) : (
                  items.map((item) => (
                    <li
                      key={item._id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2"
                    >
                      <span>
                        {item.dayOfWeek !== undefined
                          ? `${DAYS[item.dayOfWeek]} · `
                          : ""}
                        {item.title} · {item.plannedMinutes} min
                      </span>
                      {active?.status !== "approved" && (
                        <button
                          type="button"
                          className="text-xs underline"
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
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </section>
          )}
        </>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
