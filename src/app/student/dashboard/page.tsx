"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StudentProgressCharts } from "@/components/StudentProgressCharts";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";

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
  return {
    weekStart: isoDate(start),
    weekEnd: isoDate(end),
    today: isoDate(now),
    dayOfWeek: day,
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type EntryType = "native_completion" | "external_time" | "manual";

function StudentDashboardInner() {
  const user = useQuery(api.users.current);
  const viewAsStudentId = useViewAsStudentId();
  const myProfile = useQuery(
    api.students.myProfile,
    viewAsStudentId ? "skip" : {},
  );
  const viewAsContext = useQuery(
    api.students.getViewAsContext,
    viewAsStudentId ? { studentId: viewAsStudentId } : "skip",
  );

  const claimByName = useMutation(api.students.claimByName);
  const createLog = useMutation(api.logs.create);
  const requestRevision = useMutation(api.schedules.requestRevision);

  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [durationMinutes, setDurationMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("external_time");
  const [courseId, setCourseId] = useState("");

  const week = useMemo(() => weekRange(), []);

  const viewingAs = Boolean(viewAsStudentId);
  const profileLoading = viewingAs
    ? viewAsContext === undefined
    : myProfile === undefined;
  const profile = viewingAs
    ? (viewAsContext?.student ?? null)
    : (myProfile ?? null);
  const viewAsDenied = viewingAs && viewAsContext === null;

  const approved = useQuery(
    api.schedules.getApprovedForWeek,
    profile
      ? { studentId: profile._id, weekStart: week.weekStart }
      : "skip",
  );

  const schedules = useQuery(
    api.schedules.listForStudent,
    profile ? { studentId: profile._id } : "skip",
  );

  const courses = useQuery(
    api.courses.listAvailableForMyFamily,
    profile ? {} : "skip",
  );

  const todayItems =
    approved?.items.filter(
      (i) =>
        i.dayOfWeek === week.dayOfWeek ||
        i.date === week.today ||
        (i.dayOfWeek === undefined && i.date === undefined),
    ) ?? [];

  async function onClaim(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await claimByName({
        familyName: familyName.trim(),
        displayName: displayName.trim(),
      });
      setMessage("Profile linked.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onLog(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setMessage(null);
    try {
      await createLog({
        studentId: profile._id,
        entryType,
        durationMinutes: Number(durationMinutes) || 30,
        notes: notes.trim() || undefined,
        courseId: courseId ? (courseId as Id<"courses">) : undefined,
      });
      setNotes("");
      setMessage(
        viewingAs
          ? "Log saved (recorded as you, for this student)."
          : "Log saved.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }
  }

  if (user === undefined || profileLoading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  if (viewAsDenied) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">View as student</h1>
        <p className="text-sm text-neutral-600">
          You don&apos;t have permission to view this student, or the profile
          was not found.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student dashboard</h1>
        <p className="text-sm text-neutral-600">
          Link your account to a student profile your parent created. Use the
          exact family name and your display name.
        </p>
        <form onSubmit={(e) => void onClaim(e)} className="max-w-sm space-y-3">
          <label className="block text-sm">
            Family name
            <input
              className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Your student name
            <input
              className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Claim profile
          </button>
        </form>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
        <p className="text-sm text-neutral-600">
          {profile.academicLevel ?? "Student"} · week of {week.weekStart}
          {viewingAs ? " · parent preview" : ""}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Today&apos;s plan</h2>
        {!approved ? (
          <p className="text-sm text-neutral-500">
            No approved schedule for this week yet.
          </p>
        ) : todayItems.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing scheduled for {DAYS[week.dayOfWeek]} — check the full week
            below.
          </p>
        ) : (
          <ul className="text-sm">
            {todayItems.map((item) => (
              <li key={item._id} className="border-b border-neutral-100 py-2">
                {item.title} · {item.plannedMinutes} min
              </li>
            ))}
          </ul>
        )}
      </section>

      {approved && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">This week</h2>
          <ul className="text-sm">
            {approved.items.map((item) => (
              <li key={item._id} className="border-b border-neutral-100 py-2">
                {item.dayOfWeek !== undefined
                  ? `${DAYS[item.dayOfWeek]} · `
                  : ""}
                {item.title} · {item.plannedMinutes} min
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-sm underline"
            onClick={() =>
              void requestRevision({ scheduleId: approved.schedule._id })
                .then(() => setMessage("Revision requested — back to draft."))
                .catch((err) =>
                  setMessage(err instanceof Error ? err.message : "Failed"),
                )
            }
          >
            Request schedule revision
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Log learning</h2>
        <form onSubmit={(e) => void onLog(e)} className="space-y-2">
          <select
            className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryType)}
          >
            <option value="external_time">External time</option>
            <option value="native_completion">Mark lesson complete</option>
            <option value="manual">Manual</option>
          </select>
          <select
            className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">Course (optional)</option>
            {(courses ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
          <textarea
            className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            rows={2}
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="submit"
            className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Save log
          </button>
        </form>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-8">
        <StudentProgressCharts
          studentId={profile._id}
          defaultRangeDays={14}
          title="Progress"
        />
      </section>

      {schedules && schedules.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Schedule status</h2>
          <ul className="text-sm">
            {schedules.slice(0, 5).map((s) => (
              <li key={s._id} className="border-b border-neutral-100 py-1">
                {s.weekStart} → {s.weekEnd} · {s.status}
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <StudentDashboardInner />
    </Suspense>
  );
}
