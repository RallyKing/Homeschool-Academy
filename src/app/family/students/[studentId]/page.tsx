"use client";

import Link from "next/link";
import { FormEvent, Suspense, use, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ParentStudentLogsPanel } from "@/components/ParentStudentLogsPanel";
import { StudentAvatar } from "@/components/StudentAvatar";
import { StudentPhotoEditor } from "@/components/StudentPhotoEditor";
import { usePageTab } from "@/hooks/usePageTab";
import { localIsoDate, localWeekRange } from "@/lib/dates";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Message,
  Modal,
  PageHeader,
  Section,
  Select,
  TabPanel,
  Tabs,
  Textarea,
  Row,
  Col,
} from "@/components/ui";

const CONTROL_TABS = [
  "profile",
  "logs",
  "chores",
  "plan",
  "social",
  "rewards",
] as const;

type Recurrence = "once" | "daily" | "weekly";

function weekRange() {
  const { weekStart, weekEnd } = localWeekRange();
  return { weekStart, weekEnd };
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

function ProfileTab({
  student,
  gamification,
  onNotify,
  onGoRewards,
}: {
  student: {
    _id: Id<"students">;
    displayName: string;
    academicLevel?: string;
    birthYear?: number;
    imageStorageId?: Id<"_storage">;
  };
  gamification:
    | {
        profile: {
          level: number;
          xp: number;
          points: number;
          stars: number;
          currentStreak: number;
        };
        levelTitle: string;
      }
    | null
    | undefined;
  onNotify: (text: string, tone?: "success" | "error") => void;
  onGoRewards: () => void;
}) {
  const updateStudent = useMutation(api.students.update);
  const [name, setName] = useState(student.displayName);
  const [level, setLevel] = useState(student.academicLevel ?? "");
  const [birthYear, setBirthYear] = useState(
    student.birthYear ? String(student.birthYear) : "",
  );

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await updateStudent({
        studentId: student._id,
        displayName: name.trim(),
        academicLevel: level.trim() || undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
      });
      onNotify("Profile updated.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <>
      <Section title="Profile fields">
        <Card>
          <form onSubmit={(e) => void onSaveProfile(e)} className="space-y-4">
            <StudentPhotoEditor
              studentId={student._id}
              imageStorageId={student.imageStorageId}
              name={name || student.displayName}
              size="lg"
              onError={(text) => onNotify(text, "error")}
              onSuccess={(text) => onNotify(text)}
            />
            <Input
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Row gap="sm">
              <Col span={12} md={6}>
                <Input
                  label="Level"
                  placeholder="e.g. Grade 5"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                />
              </Col>
              <Col span={12} md={6}>
                <Input
                  label="Birth year"
                  type="number"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                />
              </Col>
            </Row>
            <Button type="submit">Save profile</Button>
          </form>
        </Card>
      </Section>

      {gamification?.profile ? (
        <Section title="Progress snapshot">
          <div className="list-row">
            <div>
              <p className="font-medium">
                Level {gamification.profile.level} · {gamification.levelTitle}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {gamification.profile.xp} XP · {gamification.profile.points}{" "}
                points · {gamification.profile.stars} stars ·{" "}
                {gamification.profile.currentStreak}d streak
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={onGoRewards}>
              Edit rewards
            </Button>
          </div>
        </Section>
      ) : null}
    </>
  );
}

function StudentControlInner({ studentId }: { studentId: Id<"students"> }) {
  const student = useQuery(api.students.get, { studentId });
  const family = useQuery(api.users.myFamily);
  const gamification = useQuery(api.gamification.getStudentProfile, {
    studentId,
  });
  const [tab, setTab] = usePageTab(CONTROL_TABS, "profile");
  const [flash, setFlash] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"success" | "error">("success");

  function notify(text: string, tone: "success" | "error" = "success") {
    setFlash(text);
    setFlashTone(tone);
  }

  // Chores
  const chores = useQuery(
    api.chores.listForFamily,
    family
      ? { familyId: family._id, studentId }
      : "skip",
  );
  const createChore = useMutation(api.chores.create);
  const updateChore = useMutation(api.chores.update);
  const removeChore = useMutation(api.chores.remove);
  const reopenChore = useMutation(api.chores.reopen);
  const [choreOpen, setChoreOpen] = useState(false);
  const [editChoreId, setEditChoreId] = useState<Id<"chores"> | null>(null);
  const [choreTitle, setChoreTitle] = useState("");
  const [choreDesc, setChoreDesc] = useState("");
  const [choreDue, setChoreDue] = useState("");
  const [choreRecurrence, setChoreRecurrence] = useState<Recurrence>("once");
  const [choreXp, setChoreXp] = useState("15");
  const [chorePts, setChorePts] = useState("5");

  // Plan
  const schedules = useQuery(api.schedules.listForStudent, { studentId });
  const createDraft = useMutation(api.schedules.createDraft);
  const removeSchedule = useMutation(api.schedules.remove);
  const approve = useMutation(api.schedules.approve);
  const requestApproval = useMutation(api.schedules.requestApproval);
  const requestRevision = useMutation(api.schedules.requestRevision);

  // Social
  const cheers = useQuery(api.social.listInvolvingStudent, {
    studentId,
    limit: 40,
  });
  const moderateDelete = useMutation(api.social.moderateDeleteMessage);

  // Rewards / accolades / progress
  const accolades = useQuery(api.gamification.listAccolades, {
    studentId,
    limit: 30,
  });
  const studentBadges = useQuery(api.gamification.listStudentBadges, {
    studentId,
  });
  const allBadges = useQuery(api.gamification.listBadges, {});
  const createAccolade = useMutation(api.gamification.createAccolade);
  const updateAccolade = useMutation(api.gamification.updateAccolade);
  const removeAccolade = useMutation(api.gamification.removeAccolade);
  const grantBonus = useMutation(api.gamification.grantBonus);
  const adminAdjust = useMutation(api.gamification.adminAdjust);
  const grantManualBadge = useMutation(api.gamification.grantManualBadge);
  const revokeStudentBadge = useMutation(api.gamification.revokeStudentBadge);
  const seedBadges = useMutation(api.gamification.seedBadges);
  const [accoladeOpen, setAccoladeOpen] = useState(false);
  const [editAccoladeId, setEditAccoladeId] = useState<Id<"accolades"> | null>(
    null,
  );
  const [accoladeTitle, setAccoladeTitle] = useState("");
  const [accoladeMessage, setAccoladeMessage] = useState("");
  const [bonusPts, setBonusPts] = useState("10");
  const [bonusStars, setBonusStars] = useState("1");
  const [bonusXp, setBonusXp] = useState("0");
  const [adjXp, setAdjXp] = useState("");
  const [adjPoints, setAdjPoints] = useState("");
  const [adjStars, setAdjStars] = useState("");
  const [adjStreak, setAdjStreak] = useState("");
  const [adjFreezes, setAdjFreezes] = useState("");
  const [adjWeeklyXp, setAdjWeeklyXp] = useState("");
  const [grantBadgeId, setGrantBadgeId] = useState("");
  const [progressHydrated, setProgressHydrated] = useState(false);

  useEffect(() => {
    if (!gamification?.profile || progressHydrated) return;
    const p = gamification.profile;
    setAdjXp(String(p.xp));
    setAdjPoints(String(p.points));
    setAdjStars(String(p.stars));
    setAdjStreak(String(p.currentStreak));
    setAdjFreezes(String(p.streakFreezes));
    setAdjWeeklyXp(String(p.weeklyXp));
    setProgressHydrated(true);
  }, [gamification, progressHydrated]);

  async function onSaveChore(e: FormEvent) {
    e.preventDefault();
    if (!family || !choreTitle.trim()) return;
    try {
      if (editChoreId) {
        await updateChore({
          choreId: editChoreId,
          title: choreTitle.trim(),
          description: choreDesc.trim() || undefined,
          dueDate: choreDue || undefined,
          recurrence: choreRecurrence,
          xpReward: Number(choreXp) || undefined,
          pointsReward: Number(chorePts) || undefined,
        });
        notify("Chore updated.");
      } else {
        await createChore({
          familyId: family._id,
          studentId,
          title: choreTitle.trim(),
          description: choreDesc.trim() || undefined,
          dueDate: choreDue || undefined,
          recurrence: choreRecurrence,
          xpReward: Number(choreXp) || undefined,
          pointsReward: Number(chorePts) || undefined,
        });
        notify("Chore assigned.");
      }
      setChoreOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function openCreateChore() {
    setEditChoreId(null);
    setChoreTitle("");
    setChoreDesc("");
    setChoreDue("");
    setChoreRecurrence("once");
    setChoreXp("15");
    setChorePts("5");
    setChoreOpen(true);
  }

  function openEditChore(chore: {
    _id: Id<"chores">;
    title: string;
    description?: string;
    dueDate?: string;
    recurrence: Recurrence;
    xpReward?: number;
    pointsReward?: number;
  }) {
    setEditChoreId(chore._id);
    setChoreTitle(chore.title);
    setChoreDesc(chore.description ?? "");
    setChoreDue(chore.dueDate ?? "");
    setChoreRecurrence(chore.recurrence);
    setChoreXp(String(chore.xpReward ?? 15));
    setChorePts(String(chore.pointsReward ?? 5));
    setChoreOpen(true);
  }

  function openCreateAccolade() {
    setEditAccoladeId(null);
    setAccoladeTitle("");
    setAccoladeMessage("");
    setAccoladeOpen(true);
  }

  function openEditAccolade(a: {
    _id: Id<"accolades">;
    title: string;
    message?: string;
  }) {
    setEditAccoladeId(a._id);
    setAccoladeTitle(a.title);
    setAccoladeMessage(a.message ?? "");
    setAccoladeOpen(true);
  }

  async function onSaveAccolade(e: FormEvent) {
    e.preventDefault();
    if (!accoladeTitle.trim()) return;
    try {
      if (editAccoladeId) {
        await updateAccolade({
          accoladeId: editAccoladeId,
          title: accoladeTitle.trim(),
          message: accoladeMessage.trim() || undefined,
        });
        notify("Accolade updated.");
      } else {
        await createAccolade({
          studentId,
          title: accoladeTitle.trim(),
          message: accoladeMessage.trim() || undefined,
          today: localIsoDate(),
        });
        notify("Accolade granted.");
      }
      setAccoladeOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onGrantBonus(e: FormEvent) {
    e.preventDefault();
    try {
      await grantBonus({
        studentId,
        points: Number(bonusPts) || 0,
        stars: Number(bonusStars) || 0,
        xp: Number(bonusXp) || 0,
        today: localIsoDate(),
      });
      notify("Bonus granted.");
      setProgressHydrated(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function onSaveProgress(e: FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        "Overwrite XP, points, stars, streak, and weekly XP for this student?",
      )
    ) {
      return;
    }
    try {
      const result = await adminAdjust({
        studentId,
        xp: Number(adjXp) || 0,
        points: Number(adjPoints) || 0,
        stars: Number(adjStars) || 0,
        currentStreak: Number(adjStreak) || 0,
        streakFreezes: Number(adjFreezes) || 0,
        weeklyXp: Number(adjWeeklyXp) || 0,
        today: localIsoDate(),
        reason: "family_control_center",
      });
      notify(
        `Progress saved — Level ${result.level} from ${result.xp} XP.`,
      );
      setProgressHydrated(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (student === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (student === null) {
    return (
      <div className="space-y-6">
        <Link href="/family/dashboard">
          <Button variant="ghost" size="sm">
            ← Family
          </Button>
        </Link>
        <PageHeader
          title="Student not found"
          description="You may not have access to this student profile."
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/family/dashboard?tab=students">
          <Button variant="ghost" size="sm">
            ← Students
          </Button>
        </Link>
        <Link href={`/family/progress/${student._id}`}>
          <Button variant="ghost" size="sm">
            Progress charts
          </Button>
        </Link>
        <Link href={`/student/dashboard?as=${student._id}`}>
          <Button variant="secondary" size="sm">
            View as student
          </Button>
        </Link>
      </div>

      <PageHeader
        compact
        eyebrow="Parent control"
        title={student.displayName}
        description="Complete control of everything that appears on this student’s profile — logs, chores, plan, social, and rewards."
        actions={
          <StudentAvatar
            studentId={student._id}
            imageStorageId={student.imageStorageId}
            name={student.displayName}
            size="lg"
          />
        }
      />

      <Message tone={flashTone}>{flash}</Message>

      <Tabs
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "logs", label: "Logs" },
          { id: "chores", label: "Chores" },
          { id: "plan", label: "Plan" },
          { id: "social", label: "Social" },
          { id: "rewards", label: "Rewards / Progress" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="profile" active={tab === "profile"}>
        <ProfileTab
          key={student._id}
          student={student}
          gamification={gamification}
          onNotify={notify}
          onGoRewards={() => setTab("rewards")}
        />
      </TabPanel>

      <TabPanel id="logs" active={tab === "logs"}>
        <ParentStudentLogsPanel studentId={studentId} />
      </TabPanel>

      <TabPanel id="chores" active={tab === "chores"}>
        <Section
          title="Assigned chores"
          description="Create, edit, reopen, or delete chores for this student."
        >
          <div className="mb-4">
            <Button size="sm" onClick={openCreateChore}>
              Assign chore
            </Button>
          </div>
          {!chores ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : chores.length === 0 ? (
            <EmptyState>No chores assigned.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {chores.map(({ chore }) => (
                <li key={chore._id} className="list-row">
                  <div className="min-w-0">
                    <p className="font-medium">{chore.title}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {chore.status}
                      {chore.dueDate ? ` · due ${chore.dueDate}` : ""}
                      {chore.recurrence !== "once"
                        ? ` · ${chore.recurrence}`
                        : ""}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-2">
                    <Badge
                      tone={
                        chore.status === "done"
                          ? "success"
                          : chore.status === "skipped"
                            ? "warning"
                            : "accent"
                      }
                    >
                      {chore.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditChore(chore)}
                    >
                      Edit
                    </Button>
                    {chore.status === "done" || chore.status === "skipped" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void reopenChore({ choreId: chore._id })
                            .then(() => notify("Chore reopened."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Reopen
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm("Delete this chore?")) return;
                        void removeChore({ choreId: chore._id })
                          .then(() => notify("Chore deleted."))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
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
      </TabPanel>

      <TabPanel id="plan" active={tab === "plan"}>
        <Section
          title="Weekly plans"
          description="Approve, revise, or delete schedules shown for this student."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                const { weekStart, weekEnd } = weekRange();
                void createDraft({ studentId, weekStart, weekEnd })
                  .then(() =>
                    notify(`Draft created for ${weekStart} → ${weekEnd}.`),
                  )
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  );
              }}
            >
              Create draft for this week
            </Button>
            <Link href="/family/planner">
              <Button size="sm" variant="secondary">
                Open full planner
              </Button>
            </Link>
          </div>
          {!schedules ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : schedules.length === 0 ? (
            <EmptyState>No schedules yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {schedules.map((s) => (
                <li key={s._id} className="list-row">
                  <span className="text-sm">
                    {s.weekStart} → {s.weekEnd}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    {s.status === "draft" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void requestApproval({ scheduleId: s._id })
                            .then(() => notify("Approval requested."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Request approval
                      </Button>
                    ) : null}
                    {s.status === "pending_approval" ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void approve({ scheduleId: s._id })
                              .then(() => notify("Schedule approved."))
                              .catch((err) =>
                                notify(
                                  err instanceof Error ? err.message : "Failed",
                                  "error",
                                ),
                              )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void requestRevision({ scheduleId: s._id })
                              .then(() => notify("Sent back for revision."))
                              .catch((err) =>
                                notify(
                                  err instanceof Error ? err.message : "Failed",
                                  "error",
                                ),
                              )
                          }
                        >
                          Revise
                        </Button>
                      </>
                    ) : null}
                    {s.status === "approved" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void requestRevision({ scheduleId: s._id })
                            .then(() => notify("Sent back for revision."))
                            .catch((err) =>
                              notify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                            )
                        }
                      >
                        Revise
                      </Button>
                    ) : null}
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
                          .then(() => notify("Schedule deleted."))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
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
      </TabPanel>

      <TabPanel id="social" active={tab === "social"}>
        <Section
          title="Cheers involving this student"
          description="Moderate cheers they sent or received. Removed cheers disappear from student views."
        >
          {!cheers ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : cheers.length === 0 ? (
            <EmptyState>No cheers yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {cheers.map(
                ({ message: m, fromName, toName, direction, stickerEmoji }) => (
                  <li key={m._id} className="list-row">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {stickerEmoji ? `${stickerEmoji} ` : ""}
                        {fromName} → {toName}
                        <Badge tone="neutral" className="ml-2">
                          {direction}
                        </Badge>
                      </p>
                      {m.body ? (
                        <p className="text-[var(--muted)]">{m.body}</p>
                      ) : null}
                      <p className="text-xs text-[var(--muted)]">
                        {formatWhen(m.createdAt)} · {m.kind}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm("Remove this cheer?")) return;
                        void moderateDelete({ messageId: m._id })
                          .then(() => notify("Cheer removed."))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          );
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ),
              )}
            </ul>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="rewards" active={tab === "rewards"}>
        <Section
          title="Edit progress"
          description="Set absolute XP, points, stars, streak, freezes, and this week’s XP. Level recalculates from XP (100 XP per level)."
        >
          <Card>
            <form
              onSubmit={(e) => void onSaveProgress(e)}
              className="space-y-4"
            >
              <Row gap="sm">
                <Col span={12} md={4}>
                  <Input
                    label="Total XP"
                    type="number"
                    min={0}
                    value={adjXp}
                    onChange={(e) => setAdjXp(e.target.value)}
                  />
                </Col>
                <Col span={12} md={4}>
                  <Input
                    label="Points"
                    type="number"
                    min={0}
                    value={adjPoints}
                    onChange={(e) => setAdjPoints(e.target.value)}
                  />
                </Col>
                <Col span={12} md={4}>
                  <Input
                    label="Stars"
                    type="number"
                    min={0}
                    value={adjStars}
                    onChange={(e) => setAdjStars(e.target.value)}
                  />
                </Col>
              </Row>
              <Row gap="sm">
                <Col span={12} md={4}>
                  <Input
                    label="Current streak"
                    type="number"
                    min={0}
                    value={adjStreak}
                    onChange={(e) => setAdjStreak(e.target.value)}
                  />
                </Col>
                <Col span={12} md={4}>
                  <Input
                    label="Streak freezes"
                    type="number"
                    min={0}
                    max={3}
                    value={adjFreezes}
                    onChange={(e) => setAdjFreezes(e.target.value)}
                  />
                </Col>
                <Col span={12} md={4}>
                  <Input
                    label="This week’s XP"
                    type="number"
                    min={0}
                    value={adjWeeklyXp}
                    onChange={(e) => setAdjWeeklyXp(e.target.value)}
                  />
                </Col>
              </Row>
              {gamification?.profile ? (
                <p className="text-sm text-[var(--muted)]">
                  Live: Level {gamification.profile.level} ·{" "}
                  {gamification.levelTitle} · {gamification.profile.weeklyXp}{" "}
                  weekly XP
                  {gamification.profile.weekStart
                    ? ` (week of ${gamification.profile.weekStart})`
                    : ""}
                </p>
              ) : null}
              <Button type="submit">Save progress</Button>
            </form>
          </Card>
        </Section>

        <Section title="Badges">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void seedBadges({})
                  .then((n) =>
                    notify(
                      n > 0
                        ? `Seeded ${n} system badge${n === 1 ? "" : "s"}.`
                        : "Badge catalog already seeded.",
                    ),
                  )
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  )
              }
            >
              Seed badge catalog
            </Button>
          </div>
          <Card className="mb-4">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!grantBadgeId) return;
                void grantManualBadge({
                  studentId,
                  badgeId: grantBadgeId as Id<"badges">,
                  today: localIsoDate(),
                })
                  .then(() => {
                    notify("Badge granted.");
                    setGrantBadgeId("");
                    setProgressHydrated(false);
                  })
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  );
              }}
            >
              <div className="min-w-[12rem] flex-1">
                <Select
                  label="Grant badge"
                  value={grantBadgeId}
                  onChange={(e) => setGrantBadgeId(e.target.value)}
                >
                  <option value="">Choose a badge…</option>
                  {(allBadges ?? [])
                    .filter(
                      (b) =>
                        !(studentBadges ?? []).some(
                          (sb) => sb.badge._id === b._id,
                        ),
                    )
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.title}
                      </option>
                    ))}
                </Select>
              </div>
              <Button type="submit" size="sm" disabled={!grantBadgeId}>
                Grant
              </Button>
            </form>
          </Card>
          {!studentBadges ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : studentBadges.length === 0 ? (
            <EmptyState>No badges earned yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {studentBadges.map(({ earned, badge }) => (
                <li key={earned._id} className="list-row">
                  <div>
                    <p className="font-medium">{badge.title}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {badge.description}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Revoke “${badge.title}”?`)) return;
                      void revokeStudentBadge({
                        studentBadgeId: earned._id,
                      })
                        .then(() => {
                          notify("Badge revoked.");
                          setProgressHydrated(false);
                        })
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        );
                    }}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Accolades"
          description="Shows on the student’s Quests tab. Grant here to fill an empty accolades list."
        >
          <div className="mb-4">
            <Button size="sm" onClick={openCreateAccolade}>
              Grant accolade
            </Button>
          </div>
          {!accolades ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : accolades.length === 0 ? (
            <EmptyState>
              No accolades yet — grant one above; it appears on Quests immediately.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {accolades.map((a) => (
                <li key={a._id} className="list-row">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    {a.message ? (
                      <p className="text-sm text-[var(--muted)]">{a.message}</p>
                    ) : null}
                  </div>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditAccolade(a)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm("Delete this accolade?")) return;
                        void removeAccolade({ accoladeId: a._id })
                          .then(() => notify("Accolade deleted."))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
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

        <Section
          title="Grant bonus"
          description="Add points, stars, or XP without creating an accolade. Counts toward this week’s XP."
        >
          <Card>
            <form onSubmit={(e) => void onGrantBonus(e)} className="space-y-4">
              <Row gap="sm">
                <Col span={12} md={4}>
                  <Input
                    label="Points"
                    type="number"
                    min={0}
                    value={bonusPts}
                    onChange={(e) => setBonusPts(e.target.value)}
                  />
                </Col>
                <Col span={12} md={4}>
                  <Input
                    label="Stars"
                    type="number"
                    min={0}
                    value={bonusStars}
                    onChange={(e) => setBonusStars(e.target.value)}
                  />
                </Col>
                <Col span={12} md={4}>
                  <Input
                    label="XP"
                    type="number"
                    min={0}
                    value={bonusXp}
                    onChange={(e) => setBonusXp(e.target.value)}
                  />
                </Col>
              </Row>
              <Button type="submit">Grant bonus</Button>
            </form>
          </Card>
        </Section>
      </TabPanel>

      <Modal
        open={choreOpen}
        onClose={() => setChoreOpen(false)}
        title={editChoreId ? "Edit chore" : "Assign chore"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setChoreOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="student-chore-form">
              {editChoreId ? "Save" : "Assign"}
            </Button>
          </>
        }
      >
        <form
          id="student-chore-form"
          onSubmit={(e) => void onSaveChore(e)}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={choreTitle}
            onChange={(e) => setChoreTitle(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            rows={2}
            value={choreDesc}
            onChange={(e) => setChoreDesc(e.target.value)}
          />
          <Input
            label="Due date"
            type="date"
            value={choreDue}
            onChange={(e) => setChoreDue(e.target.value)}
          />
          <Select
            label="Recurrence"
            value={choreRecurrence}
            onChange={(e) => setChoreRecurrence(e.target.value as Recurrence)}
          >
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </Select>
          <Row gap="sm">
            <Col span={12} md={6}>
              <Input
                label="XP reward"
                type="number"
                value={choreXp}
                onChange={(e) => setChoreXp(e.target.value)}
              />
            </Col>
            <Col span={12} md={6}>
              <Input
                label="Points reward"
                type="number"
                value={chorePts}
                onChange={(e) => setChorePts(e.target.value)}
              />
            </Col>
          </Row>
        </form>
      </Modal>

      <Modal
        open={accoladeOpen}
        onClose={() => setAccoladeOpen(false)}
        title={editAccoladeId ? "Edit accolade" : "Grant accolade"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAccoladeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="student-accolade-form">
              {editAccoladeId ? "Save" : "Grant"}
            </Button>
          </>
        }
      >
        <form
          id="student-accolade-form"
          onSubmit={(e) => void onSaveAccolade(e)}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={accoladeTitle}
            onChange={(e) => setAccoladeTitle(e.target.value)}
            required
          />
          <Textarea
            label="Message"
            rows={3}
            value={accoladeMessage}
            onChange={(e) => setAccoladeMessage(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}

export default function ParentStudentControlPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId: rawId } = use(params);
  const studentId = rawId as Id<"students">;

  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <StudentControlInner studentId={studentId} />
    </Suspense>
  );
}
