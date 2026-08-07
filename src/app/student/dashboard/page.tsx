"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StudentProgressCharts } from "@/components/StudentProgressCharts";
import { StudentAvatar } from "@/components/StudentAvatar";
import { StudentPhotoEditor } from "@/components/StudentPhotoEditor";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
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
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");

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

  function notify(text: string, tone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function onClaim(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await claimByName({
        familyName: familyName.trim(),
        displayName: displayName.trim(),
      });
      notify("Profile linked.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
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
      notify(
        viewingAs
          ? "Log saved (recorded as you, for this student)."
          : "Log saved.",
        "success",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (user === undefined || profileLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  if (viewAsDenied) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="View as student"
          description="You don't have permission to view this student, or the profile was not found."
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Student"
          title="Dashboard"
          description="Link your account to a student profile your parent created. Use the exact family name and your display name."
        />
        <Card padding="lg" className="max-w-md">
          <form onSubmit={(e) => void onClaim(e)} className="space-y-4">
            <Input
              label="Family name"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              required
            />
            <Input
              label="Your student name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Button type="submit">Claim profile</Button>
          </form>
        </Card>
        <Message tone={messageTone}>{message}</Message>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6 animate-fade-up">
        <div className="flex min-w-0 items-center gap-4">
          <StudentAvatar
            studentId={profile._id}
            imageStorageId={profile.imageStorageId}
            name={profile.displayName}
            size="xl"
          />
          <div className="min-w-0 max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {profile.academicLevel ?? "Student"}
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
              {profile.displayName}
            </h1>
            <p className="mt-2 text-base text-[var(--muted)] leading-relaxed">
              {`Week of ${week.weekStart}${viewingAs ? " · parent preview" : ""}`}
            </p>
          </div>
        </div>
        {viewingAs ? <Badge tone="warning">Preview mode</Badge> : null}
      </header>

      <Message tone={messageTone}>{message}</Message>

      <Section
        title="Profile photo"
        description="Choose a photo that shows on your dashboard and family lists."
      >
        <StudentPhotoEditor
          studentId={profile._id}
          imageStorageId={profile.imageStorageId}
          name={profile.displayName}
          size="xl"
          onError={(text) => notify(text, "error")}
          onSuccess={(text) => notify(text, "success")}
        />
      </Section>

      <Row gap="lg">
        <Col span={12} lg={6}>
          <Section title="Today's plan">
            {!approved ? (
              <EmptyState>No approved schedule for this week yet.</EmptyState>
            ) : todayItems.length === 0 ? (
              <EmptyState>
                Nothing scheduled for {DAYS[week.dayOfWeek]} — check the full week
                below.
              </EmptyState>
            ) : (
              <div className="space-y-2">
                {todayItems.map((item) => (
                  <div key={item._id} className="list-row">
                    <span className="font-medium">{item.title}</span>
                    <Badge tone="neutral">{item.plannedMinutes} min</Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>

        {approved && (
          <Col span={12} lg={6}>
            <Section
              title="This week"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void requestRevision({ scheduleId: approved.schedule._id })
                      .then(() =>
                        notify("Revision requested — back to draft.", "success"),
                      )
                      .catch((err) =>
                        notify(err instanceof Error ? err.message : "Failed", "error"),
                      )
                  }
                >
                  Request revision
                </Button>
              }
            >
              <div className="space-y-2">
                {approved.items.map((item) => (
                  <div key={item._id} className="list-row">
                    <span>
                      {item.dayOfWeek !== undefined
                        ? `${DAYS[item.dayOfWeek]} · `
                        : ""}
                      {item.title}
                    </span>
                    <Badge tone="neutral">{item.plannedMinutes} min</Badge>
                  </div>
                ))}
              </div>
            </Section>
          </Col>
        )}
      </Row>

      <Section title="Log learning" description="Record time spent or mark lessons complete.">
        <Card padding="md" className="max-w-xl">
          <form onSubmit={(e) => void onLog(e)} className="space-y-4">
            <Select
              label="Entry type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as EntryType)}
            >
              <option value="external_time">External time</option>
              <option value="native_completion">Mark lesson complete</option>
              <option value="manual">Manual</option>
            </Select>
            <Select
              label="Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Optional</option>
              {(courses ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </Select>
            <Input
              label="Duration (minutes)"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
            <Textarea
              label="Notes"
              rows={2}
              placeholder="What did you work on?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button type="submit">Save log</Button>
          </form>
        </Card>
      </Section>

      <Section title="Progress">
        <StudentProgressCharts
          studentId={profile._id}
          defaultRangeDays={14}
          title=""
        />
      </Section>

      {schedules && schedules.length > 0 && (
        <Section title="Schedule status">
          <div className="space-y-2">
            {schedules.slice(0, 5).map((s) => (
              <div key={s._id} className="list-row">
                <span className="text-sm">
                  {s.weekStart} → {s.weekEnd}
                </span>
                <Badge
                  tone={
                    s.status === "approved"
                      ? "success"
                      : s.status === "draft"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <StudentDashboardInner />
    </Suspense>
  );
}
