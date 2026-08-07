"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StudentProgressCharts } from "@/components/StudentProgressCharts";
import { StudentAvatar } from "@/components/StudentAvatar";
import { StudentPhotoEditor } from "@/components/StudentPhotoEditor";
import { StudentGamificationPanel } from "@/components/StudentGamificationPanel";
import { CourseAssistPanel } from "@/components/CourseAssistPanel";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { withViewAs } from "@/lib/viewAs";
import { usePageTab } from "@/hooks/usePageTab";
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
  Row,
  Col,
  Tabs,
  TabPanel,
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
const STUDENT_TABS = [
  "home",
  "quests",
  "plan",
  "log",
  "chores",
  "cheer",
  "profile",
] as const;

type EntryType = "native_completion" | "external_time" | "manual";

function StudentDashboardInner() {
  const user = useQuery(api.users.current);
  const viewAsStudentId = useViewAsStudentId();
  const [tab, setTab] = usePageTab(STUDENT_TABS, "home");
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
  const markDone = useMutation(api.chores.markDone);
  const skipChore = useMutation(api.chores.skip);

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

  const openChores = useQuery(
    api.chores.listMine,
    profile ? { studentId: profile._id, status: "todo" } : "skip",
  );

  const recentCheers = useQuery(
    api.social.listRecentForStudent,
    profile ? { studentId: profile._id, limit: 4 } : "skip",
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
        today: week.today,
        weekStart: week.weekStart,
      });
      setNotes("");
      notify(
        viewingAs
          ? "Log saved — XP and points awarded (parent preview)."
          : "Log saved — nice work! XP and points awarded.",
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
      <div className="page-stack">
        <h1 className="font-display text-2xl font-semibold">View as student</h1>
        <p className="text-sm text-[var(--muted)]">
          You don&apos;t have permission to view this student, or the profile was
          not found.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-stack">
        <header className="border-b border-[var(--border)] pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            Student
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Link your account with the exact family name and your display name.
          </p>
        </header>
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
    <div className="page-stack">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4 animate-fade-up">
        <div className="flex min-w-0 items-center gap-3">
          <StudentAvatar
            studentId={profile._id}
            imageStorageId={profile.imageStorageId}
            name={profile.displayName}
            size="lg"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              {profile.academicLevel ?? "Student"}
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.displayName}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {`Week of ${week.weekStart}${viewingAs ? " · parent preview" : ""}`}
            </p>
          </div>
        </div>
        {viewingAs ? <Badge tone="warning">Preview mode</Badge> : null}
      </header>

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        tabs={[
          { id: "home", label: "Home" },
          { id: "quests", label: "Quests" },
          { id: "plan", label: "Plan" },
          { id: "log", label: "Log" },
          {
            id: "chores",
            label: "Chores",
            count: openChores?.length,
          },
          {
            id: "cheer",
            label: "Cheer",
            count: recentCheers?.length,
          },
          { id: "profile", label: "Profile" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="home" active={tab === "home"}>
        <Row gap="md">
          <Col span={12} lg={6}>
            <Section
              title="Today"
              action={
                <Button variant="ghost" size="sm" onClick={() => setTab("plan")}>
                  Full week
                </Button>
              }
            >
              {!approved ? (
                <EmptyState>No approved schedule for this week yet.</EmptyState>
              ) : todayItems.length === 0 ? (
                <EmptyState>
                  Nothing scheduled for {DAYS[week.dayOfWeek]}.
                </EmptyState>
              ) : (
                <div className="space-y-1.5">
                  {todayItems.map((item) => (
                    <div key={item._id} className="list-row list-row-dense">
                      <span className="font-medium">{item.title}</span>
                      <Badge tone="neutral">{item.plannedMinutes} min</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Col>
          <Col span={12} lg={6}>
            <Section
              title="Open chores"
              action={
                <Button variant="ghost" size="sm" onClick={() => setTab("chores")}>
                  All chores
                </Button>
              }
            >
              {!openChores || openChores.length === 0 ? (
                <EmptyState>You&apos;re clear — no open chores.</EmptyState>
              ) : (
                <div className="space-y-1.5">
                  {openChores.slice(0, 4).map((c) => (
                    <div key={c._id} className="list-row list-row-dense">
                      <span className="font-medium">{c.title}</span>
                      <Button
                        size="sm"
                        onClick={() =>
                          void markDone({ choreId: c._id, today: week.today })
                            .then(() => notify("Chore complete!", "success"))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Done
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Col>
        </Row>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setTab("log")}>
            Log learning
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTab("quests")}>
            Quests & rewards
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTab("cheer")}>
            Cheer siblings
          </Button>
          <Link href={withViewAs("/alerts", viewAsStudentId)}>
            <Button variant="ghost" size="sm">
              Alerts
            </Button>
          </Link>
        </div>

        {recentCheers && recentCheers.length > 0 ? (
          <Section
            title="Recent cheers"
            description="Warm notes from siblings — not a leaderboard."
            action={
              <Link href={withViewAs("/student/social", viewAsStudentId)}>
                <Button variant="ghost" size="sm">
                  Cheer Hub
                </Button>
              </Link>
            }
          >
            <div className="space-y-1.5">
              {recentCheers.map(({ message: m, fromName, stickerEmoji }) => (
                <div key={m._id} className="list-row list-row-dense">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{fromName}</span>
                    {stickerEmoji ? ` ${stickerEmoji}` : ""}
                    {m.body ? ` — ${m.body}` : ""}
                  </span>
                  <Badge tone="success">{m.kind}</Badge>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </TabPanel>

      <TabPanel id="quests" active={tab === "quests"}>
        <StudentGamificationPanel
          studentId={profile._id}
          familyId={profile.familyId}
          viewAsStudentId={viewAsStudentId}
        />
      </TabPanel>

      <TabPanel id="plan" active={tab === "plan"}>
        <Row gap="lg">
          <Col span={12} lg={6}>
            <Section title="Today's plan">
              {!approved ? (
                <EmptyState>No approved schedule for this week yet.</EmptyState>
              ) : todayItems.length === 0 ? (
                <EmptyState>
                  Nothing scheduled for {DAYS[week.dayOfWeek]}.
                </EmptyState>
              ) : (
                <div className="space-y-1.5">
                  {todayItems.map((item) => (
                    <div key={item._id} className="list-row list-row-dense">
                      <span className="font-medium">{item.title}</span>
                      <Badge tone="neutral">{item.plannedMinutes} min</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Col>
          {approved ? (
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
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        )
                    }
                  >
                    Request revision
                  </Button>
                }
              >
                <div className="space-y-1.5">
                  {approved.items.map((item) => (
                    <div key={item._id} className="list-row list-row-dense">
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
          ) : null}
        </Row>

        {schedules && schedules.length > 0 ? (
          <Section title="Schedule status">
            <div className="space-y-1.5">
              {schedules.slice(0, 5).map((s) => (
                <div key={s._id} className="list-row list-row-dense">
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
        ) : null}

        {courses && courses.length > 0 ? (
          <Section
            title="Course assist"
            description="Short, on-topic help for one of your courses. Stays within family-safe guidelines."
          >
            <div className="mb-3 max-w-md">
              <Select
                label="Course"
                value={courseId || courses[0]?._id || ""}
                onChange={(e) => setCourseId(e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
            <CourseAssistPanel
              studentId={profile._id}
              courseId={(courseId || courses[0]._id) as Id<"courses">}
              parentGuardrailContext="Age-appropriate educational help only. Stay on course topic. No cheating. block: dating, weapons, violence"
            />
          </Section>
        ) : null}
      </TabPanel>

      <TabPanel id="log" active={tab === "log"}>
        <Section title="Log learning" description="Record time or mark lessons complete.">
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
      </TabPanel>

      <TabPanel id="chores" active={tab === "chores"}>
        <Section
          title="Your chores"
          action={
            <Link href={withViewAs("/student/chores", viewAsStudentId)}>
              <Button variant="ghost" size="sm">
                Full page
              </Button>
            </Link>
          }
        >
          {!openChores ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : openChores.length === 0 ? (
            <EmptyState>No open chores — nice work.</EmptyState>
          ) : (
            <div className="space-y-1.5">
              {openChores.map((c) => (
                <div key={c._id} className="list-row list-row-dense">
                  <div className="min-w-0">
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.dueDate ? `due ${c.dueDate} · ` : ""}
                      {c.xpReward ? `+${c.xpReward} XP` : ""}
                    </p>
                  </div>
                  <span className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() =>
                        void markDone({ choreId: c._id, today: week.today })
                          .then(() => notify("Chore complete!", "success"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      Done
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void skipChore({ choreId: c._id })
                          .then(() => notify("Skipped.", "info"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      Skip
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="cheer" active={tab === "cheer"}>
        <Section
          title="Encouragement Circle"
          description="Cheer siblings, send stickers, and unlock themes by giving kindness."
          action={
            <Link href={withViewAs("/student/social", viewAsStudentId)}>
              <Button size="sm">Open Cheer Hub</Button>
            </Link>
          }
        >
          {!recentCheers ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : recentCheers.length === 0 ? (
            <EmptyState>
              No cheers yet — open Cheer Hub to encourage a sibling.
            </EmptyState>
          ) : (
            <div className="space-y-1.5">
              {recentCheers.map(({ message: m, fromName, stickerEmoji }) => (
                <div key={m._id} className="list-row list-row-dense">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{fromName}</span>
                    {stickerEmoji ? ` ${stickerEmoji}` : ""}
                    {m.body ? ` — ${m.body}` : ""}
                  </span>
                  <Badge tone="success">{m.kind}</Badge>
                </div>
              ))}
            </div>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="profile" active={tab === "profile"}>
        <Section
          title="Profile photo"
          description="Shown on your dashboard and family lists."
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
      </TabPanel>
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
