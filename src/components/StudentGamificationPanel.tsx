"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { withViewAs } from "@/lib/viewAs";
import { localIsoDate, localWeekStart } from "@/lib/dates";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Row,
  Col,
  Section,
} from "@/components/ui";

const ICON_LABEL: Record<string, string> = {
  spark: "✦",
  book: "▣",
  flame: "▲",
  star: "★",
  check: "✓",
  clock: "◷",
  compass: "◎",
  medal: "◈",
  heart: "♥",
};

export function StudentGamificationPanel({
  studentId,
  familyId,
  displayName,
  imageStorageId,
  viewAsStudentId,
  celebrateLevel,
}: {
  studentId: Id<"students">;
  familyId: Id<"families">;
  displayName?: string;
  imageStorageId?: Id<"_storage">;
  viewAsStudentId?: string | null;
  celebrateLevel?: number | null;
}) {
  const today = localIsoDate();
  const weekStart = localWeekStart();

  const ensureProfile = useMutation(api.gamification.ensureStudentProfile);
  const ensureQuests = useMutation(api.gamification.ensureQuestsForToday);
  const seedBadges = useMutation(api.gamification.seedBadges);
  const redeem = useMutation(api.gamification.redeemReward);

  const profile = useQuery(api.gamification.getStudentProfile, { studentId });
  const badges = useQuery(api.gamification.listStudentBadges, { studentId });
  const accolades = useQuery(api.gamification.listAccolades, {
    studentId,
    limit: 5,
  });
  const quests = useQuery(api.gamification.listDailyQuests, {
    studentId,
    today,
  });
  const rewards = useQuery(api.gamification.listRewards, {
    familyId,
    activeOnly: true,
  });
  const leaderboard = useQuery(api.gamification.familyLeaderboard, {
    familyId,
    weekStart,
    sortBy: "xp",
  });
  const openChores = useQuery(api.chores.listMine, {
    studentId,
    status: "todo",
  });

  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const bootstrapStarted = useRef(false);
  const levelPulse = Boolean(celebrateLevel && celebrateLevel > 1);

  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    void (async () => {
      try {
        await ensureProfile({ studentId, weekStart });
        await ensureQuests({ studentId, today });
        await seedBadges({});
      } catch {
        /* parents seed; students may lack role for seed */
      }
    })();
  }, [ensureProfile, ensureQuests, seedBadges, studentId, today, weekStart]);

  const g = profile?.profile;
  const choresHref = withViewAs("/student/chores", viewAsStudentId);

  async function onRedeem(rewardId: Id<"rewardCatalog">) {
    setShopMsg(null);
    try {
      await redeem({ rewardId, studentId });
      setShopMsg("Redeemed — waiting for a parent to fulfill.");
    } catch (err) {
      setShopMsg(err instanceof Error ? err.message : "Could not redeem");
    }
  }

  return (
    <div className="space-y-6">
      <Section
        title="Your progress"
        description="XP levels you up. Points buy rewards. Stars show prestige."
        action={
          <Link href={choresHref}>
            <Button variant="secondary" size="sm">
              Chores
              {openChores && openChores.length > 0
                ? ` (${openChores.length})`
                : ""}
            </Button>
          </Link>
        }
      >
        {!g ? (
          <Card padding="md">
            <p className="text-sm text-[var(--muted)]">Loading your adventure…</p>
          </Card>
        ) : (
          <div
            className={`gamification-hero ${levelPulse ? "level-up-pulse" : ""}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {displayName ? (
                  <StudentAvatar
                    studentId={studentId}
                    imageStorageId={imageStorageId}
                    name={displayName}
                    size="lg"
                  />
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                    Level {g.level} · {profile.levelTitle}
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
                    {g.xp} XP
                  </p>
                  <div className="xp-bar mt-3">
                    <div
                      className="xp-bar-fill"
                      style={{ width: `${Math.min(100, profile.xpRatio * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    {profile.xpIntoLevel} / {profile.xpNeeded} XP to next level
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <StatPill label="Points" value={g.points} tone="accent" />
                <StatPill label="Stars" value={g.stars} tone="warning" />
                <StatPill
                  label="Streak"
                  value={`${g.currentStreak}d`}
                  tone="success"
                  hint={
                    g.streakFreezes > 0
                      ? `${g.streakFreezes} freeze${g.streakFreezes === 1 ? "" : "s"}`
                      : "Best " + g.longestStreak
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Section>

      <Row gap="lg">
        <Col span={12} lg={6}>
          <Section title="Daily quests">
            {!quests || quests.length === 0 ? (
              <EmptyState>Quests appear once you start today.</EmptyState>
            ) : (
              <div className="space-y-2">
                {quests.map((q) => {
                  const pct = Math.min(
                    100,
                    (q.currentValue / q.targetValue) * 100,
                  );
                  return (
                    <div key={q._id} className="list-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{q.title}</span>
                          {q.completed ? (
                            <Badge tone="success">Done</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {q.description}
                        </p>
                        <div className="xp-bar mt-2 h-1.5">
                          <div
                            className="xp-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--muted-fg)]">
                          {q.currentValue}/{q.targetValue} · +{q.xpReward} XP · +
                          {q.pointsReward} pts
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </Col>

        <Col span={12} lg={6}>
          <Section title="Badge shelf">
            {!badges || badges.length === 0 ? (
              <EmptyState>
                Earn badges by logging, streaking, and finishing chores.
              </EmptyState>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map(({ badge, earned }) => (
                  <div
                    key={earned._id}
                    className="badge-chip"
                    title={badge.description}
                  >
                    <span className="badge-icon" aria-hidden>
                      {ICON_LABEL[badge.iconKey ?? ""] ?? "◆"}
                    </span>
                    <span>{badge.title}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>
      </Row>

      <Row gap="lg">
        <Col span={12} lg={6}>
          <Section title="Recent accolades">
            {!accolades || accolades.length === 0 ? (
              <EmptyState>
                No accolades yet — a parent can grant one from Manage → this
                student → Rewards.
              </EmptyState>
            ) : (
              <div className="space-y-2">
                {accolades.map((a) => (
                  <div key={a._id} className="list-row">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      {a.message ? (
                        <p className="text-sm text-[var(--muted)]">{a.message}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>

        <Col span={12} lg={6}>
          <Section
            title="Family leaderboard"
            description="This week’s XP (totals stay on your level bar)"
          >
            {!leaderboard || leaderboard.length === 0 ? (
              <EmptyState>No rankings yet.</EmptyState>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 6).map((row) => (
                  <div key={row.studentId} className="list-row">
                    <span className="font-medium">
                      <span className="mr-2 text-[var(--muted-fg)]">
                        #{row.rank}
                      </span>
                      {row.displayName}
                      {row.studentId === studentId ? " · you" : ""}
                    </span>
                    <Badge tone="neutral">{row.weeklyXp} XP</Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>
      </Row>

      <Section
        title="Rewards shop"
        description="Spend points on rewards your family set up."
      >
        {shopMsg ? (
          <p className="mb-3 text-sm text-[var(--muted)]">{shopMsg}</p>
        ) : null}
        {!rewards || rewards.length === 0 ? (
          <EmptyState>
            No rewards yet — ask a parent to add some under Life → Chores & rewards.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewards.map((r) => (
              <Card key={r._id} padding="md" interactive>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    {r.description ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {r.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
                      {r.costPoints} points
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!g || g.points < r.costPoints}
                    onClick={() => void onRedeem(r._id)}
                  >
                    Redeem
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone: "accent" | "warning" | "success";
  hint?: string;
}) {
  const colors = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    success: "bg-[rgba(4,120,87,0.1)] text-[var(--success)]",
  };
  return (
    <div
      className={`min-w-[5.5rem] rounded-[var(--radius-md)] px-3.5 py-2.5 ${colors[tone]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="font-display text-xl font-semibold">{value}</p>
      {hint ? <p className="text-[10px] opacity-70">{hint}</p> : null}
    </div>
  );
}
