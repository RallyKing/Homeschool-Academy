import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** XP is permanent progression. Points are spendable. Stars are prestige. */
export const XP_PER_LEVEL = 100;

export const LEVEL_TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 1, title: "Novice" },
  { minLevel: 3, title: "Apprentice" },
  { minLevel: 5, title: "Explorer" },
  { minLevel: 8, title: "Scholar" },
  { minLevel: 12, title: "Adept" },
  { minLevel: 16, title: "Sage" },
  { minLevel: 20, title: "Master" },
  { minLevel: 25, title: "Luminary" },
];

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0]!.title;
  for (const row of LEVEL_TITLES) {
    if (level >= row.minLevel) title = row.title;
  }
  return title;
}

export function xpProgressInLevel(xp: number): {
  level: number;
  intoLevel: number;
  needed: number;
  ratio: number;
} {
  const level = levelFromXp(xp);
  const intoLevel = xp % XP_PER_LEVEL;
  return {
    level,
    intoLevel,
    needed: XP_PER_LEVEL,
    ratio: intoLevel / XP_PER_LEVEL,
  };
}

/** Previous calendar day for YYYY-MM-DD (UTC-safe string math). */
export function previousDateString(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay!, am! - 1, ad!);
  const db = Date.UTC(by!, bm! - 1, bd!);
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

export type AwardSource =
  | "log"
  | "chore"
  | "accolade"
  | "quest"
  | "badge"
  | "bonus"
  | "social";

export type AwardResult = {
  xpGained: number;
  pointsGained: number;
  starsGained: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  levelTitle: string;
  streak: number;
  streakBroke: boolean;
  freezeUsed: boolean;
  comebackBonus: boolean;
  newBadges: Array<{ _id: Id<"badges">; key: string; title: string }>;
};

export type AwardArgs = {
  studentId: Id<"students">;
  familyId: Id<"families">;
  today: string; // YYYY-MM-DD from client
  weekStart?: string;
  xp: number;
  points: number;
  stars: number;
  source: AwardSource;
  /** Extra counters for badge criteria */
  logIncrement?: number;
  choreIncrement?: number;
  minutesIncrement?: number;
  newSubject?: boolean;
  /** Prevent recursion when awarding quest completion rewards */
  skipQuests?: boolean;
  /** Skip streak update (e.g. pure shop refunds / internal adjustments) */
  skipStreak?: boolean;
};

const DEFAULT_QUESTS: Array<{
  questKey: string;
  title: string;
  description: string;
  targetValue: number;
  xpReward: number;
  pointsReward: number;
}> = [
  {
    questKey: "log_30_min",
    title: "Focus block",
    description: "Log at least 30 minutes of learning today.",
    targetValue: 30,
    xpReward: 15,
    pointsReward: 10,
  },
  {
    questKey: "complete_chore",
    title: "Responsibility",
    description: "Complete 1 chore today.",
    targetValue: 1,
    xpReward: 12,
    pointsReward: 8,
  },
  {
    questKey: "earn_2_stars",
    title: "Star seeker",
    description: "Earn 2 stars today.",
    targetValue: 2,
    xpReward: 10,
    pointsReward: 6,
  },
];

export async function getOrCreateGamification(
  ctx: MutationCtx,
  studentId: Id<"students">,
  familyId: Id<"families">,
): Promise<Doc<"studentGamification">> {
  const existing = await ctx.db
    .query("studentGamification")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("studentGamification", {
    studentId,
    familyId,
    xp: 0,
    level: 1,
    points: 0,
    stars: 0,
    currentStreak: 0,
    longestStreak: 0,
    streakFreezes: 1,
    weeklyXp: 0,
    weeklyPoints: 0,
    weeklyStars: 0,
    totalLogs: 0,
    totalChoresCompleted: 0,
    totalMinutesLogged: 0,
    distinctSubjectsLogged: 0,
    updatedAt: Date.now(),
  });
  const doc = await ctx.db.get("studentGamification", id);
  if (!doc) throw new Error("Failed to create gamification profile");
  return doc;
}

function applyWeekly(
  profile: Doc<"studentGamification">,
  weekStart: string | undefined,
  xp: number,
  points: number,
  stars: number,
): {
  weeklyXp: number;
  weeklyPoints: number;
  weeklyStars: number;
  weekStart: string | undefined;
} {
  if (!weekStart) {
    return {
      weeklyXp: profile.weeklyXp + xp,
      weeklyPoints: profile.weeklyPoints + points,
      weeklyStars: profile.weeklyStars + stars,
      weekStart: profile.weekStart,
    };
  }
  if (profile.weekStart !== weekStart) {
    return {
      weeklyXp: xp,
      weeklyPoints: points,
      weeklyStars: stars,
      weekStart,
    };
  }
  return {
    weeklyXp: profile.weeklyXp + xp,
    weeklyPoints: profile.weeklyPoints + points,
    weeklyStars: profile.weeklyStars + stars,
    weekStart,
  };
}

type StreakUpdate = {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string;
  streakFreezes: number;
  streakBroke: boolean;
  freezeUsed: boolean;
  comebackBonus: boolean;
  bonusXp: number;
  bonusPoints: number;
};

function computeStreak(
  profile: Doc<"studentGamification">,
  today: string,
): StreakUpdate {
  const last = profile.lastCompletionDate;
  if (last === today) {
    return {
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      lastCompletionDate: today,
      streakFreezes: profile.streakFreezes,
      streakBroke: false,
      freezeUsed: false,
      comebackBonus: false,
      bonusXp: 0,
      bonusPoints: 0,
    };
  }

  const yesterday = previousDateString(today);
  if (!last) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(profile.longestStreak, 1),
      lastCompletionDate: today,
      streakFreezes: profile.streakFreezes,
      streakBroke: false,
      freezeUsed: false,
      comebackBonus: false,
      bonusXp: 0,
      bonusPoints: 0,
    };
  }

  if (last === yesterday) {
    const next = profile.currentStreak + 1;
    return {
      currentStreak: next,
      longestStreak: Math.max(profile.longestStreak, next),
      lastCompletionDate: today,
      streakFreezes: profile.streakFreezes,
      streakBroke: false,
      freezeUsed: false,
      comebackBonus: false,
      bonusXp: 0,
      bonusPoints: 0,
    };
  }

  const gap = daysBetween(last, today);
  // Missed exactly one day → spend a freeze if available
  if (gap === 2 && profile.streakFreezes > 0) {
    const next = profile.currentStreak + 1;
    return {
      currentStreak: next,
      longestStreak: Math.max(profile.longestStreak, next),
      lastCompletionDate: today,
      streakFreezes: profile.streakFreezes - 1,
      streakBroke: false,
      freezeUsed: true,
      comebackBonus: false,
      bonusXp: 0,
      bonusPoints: 0,
    };
  }

  // Comeback: streak broke, grant small bonus for returning
  const hadStreak = profile.currentStreak >= 3;
  return {
    currentStreak: 1,
    longestStreak: profile.longestStreak,
    lastCompletionDate: today,
    streakFreezes: profile.streakFreezes,
    streakBroke: true,
    freezeUsed: false,
    comebackBonus: hadStreak,
    bonusXp: hadStreak ? 5 : 0,
    bonusPoints: hadStreak ? 5 : 0,
  };
}

async function evaluateBadges(
  ctx: MutationCtx,
  studentId: Id<"students">,
  profile: {
    totalLogs: number;
    currentStreak: number;
    stars: number;
    totalChoresCompleted: number;
    totalMinutesLogged: number;
    distinctSubjectsLogged: number;
    level: number;
  },
): Promise<Array<{ _id: Id<"badges">; key: string; title: string; xpReward?: number; pointsReward?: number }>> {
  const badges = await ctx.db.query("badges").collect();
  const earned = await ctx.db
    .query("studentBadges")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  const earnedIds = new Set(earned.map((e) => e.badgeId));

  const newly: Array<{
    _id: Id<"badges">;
    key: string;
    title: string;
    xpReward?: number;
    pointsReward?: number;
  }> = [];

  for (const badge of badges) {
    if (earnedIds.has(badge._id)) continue;
    if (badge.criteriaType === "manual") continue;
    const need = badge.criteriaValue ?? 1;
    let met = false;
    switch (badge.criteriaType) {
      case "logs_count":
        met = profile.totalLogs >= need;
        break;
      case "streak":
        met = profile.currentStreak >= need;
        break;
      case "stars":
        met = profile.stars >= need;
        break;
      case "chores_completed":
        met = profile.totalChoresCompleted >= need;
        break;
      case "minutes_logged":
        met = profile.totalMinutesLogged >= need;
        break;
      case "subjects_explored":
        met = profile.distinctSubjectsLogged >= need;
        break;
      case "level":
        met = profile.level >= need;
        break;
      default:
        met = false;
    }
    if (met) {
      newly.push({
        _id: badge._id,
        key: badge.key,
        title: badge.title,
        xpReward: badge.xpReward,
        pointsReward: badge.pointsReward,
      });
    }
  }
  return newly;
}

export async function awardProgress(
  ctx: MutationCtx,
  args: AwardArgs,
): Promise<AwardResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.today)) {
    throw new Error("today must be YYYY-MM-DD");
  }

  const profile = await getOrCreateGamification(
    ctx,
    args.studentId,
    args.familyId,
  );

  const streak = args.skipStreak
    ? {
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        lastCompletionDate: profile.lastCompletionDate ?? args.today,
        streakFreezes: profile.streakFreezes,
        streakBroke: false,
        freezeUsed: false,
        comebackBonus: false,
        bonusXp: 0,
        bonusPoints: 0,
      }
    : computeStreak(profile, args.today);
  let xpGain = Math.max(0, args.xp) + streak.bonusXp;
  let pointsGain = Math.max(0, args.points) + streak.bonusPoints;
  const starsGain = Math.max(0, args.stars);

  const previousLevel = profile.level;
  const weekly = applyWeekly(
    profile,
    args.weekStart,
    xpGain,
    pointsGain,
    starsGain,
  );

  const totalLogs = profile.totalLogs + (args.logIncrement ?? 0);
  const totalChoresCompleted =
    profile.totalChoresCompleted + (args.choreIncrement ?? 0);
  const totalMinutesLogged =
    profile.totalMinutesLogged + (args.minutesIncrement ?? 0);
  const distinctSubjectsLogged =
    profile.distinctSubjectsLogged + (args.newSubject ? 1 : 0);

  let xp = profile.xp + xpGain;
  let points = profile.points + pointsGain;
  const stars = profile.stars + starsGain;
  let level = levelFromXp(xp);

  await ctx.db.patch("studentGamification", profile._id, {
    xp,
    points,
    stars,
    level,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastCompletionDate: streak.lastCompletionDate,
    streakFreezes: streak.streakFreezes,
    weeklyXp: weekly.weeklyXp,
    weeklyPoints: weekly.weeklyPoints,
    weeklyStars: weekly.weeklyStars,
    weekStart: weekly.weekStart,
    totalLogs,
    totalChoresCompleted,
    totalMinutesLogged,
    distinctSubjectsLogged,
    updatedAt: Date.now(),
  });

  if (!args.skipQuests) {
    await bumpDailyQuests(ctx, {
      studentId: args.studentId,
      familyId: args.familyId,
      today: args.today,
      minutes: args.minutesIncrement ?? 0,
      chores: args.choreIncrement ?? 0,
      stars: starsGain,
    });
  }

  const newBadges = await evaluateBadges(ctx, args.studentId, {
    totalLogs,
    currentStreak: streak.currentStreak,
    stars,
    totalChoresCompleted,
    totalMinutesLogged,
    distinctSubjectsLogged,
    level,
  });

  const awardedBadgeSummaries: AwardResult["newBadges"] = [];
  for (const badge of newBadges) {
    await ctx.db.insert("studentBadges", {
      studentId: args.studentId,
      badgeId: badge._id,
      earnedAt: Date.now(),
      createdAt: Date.now(),
    });
    awardedBadgeSummaries.push({
      _id: badge._id,
      key: badge.key,
      title: badge.title,
    });
    const bx = badge.xpReward ?? 0;
    const bp = badge.pointsReward ?? 0;
    if (bx > 0 || bp > 0) {
      xp += bx;
      points += bp;
      xpGain += bx;
      pointsGain += bp;
      level = levelFromXp(xp);
      await ctx.db.patch("studentGamification", profile._id, {
        xp,
        points,
        level,
        updatedAt: Date.now(),
      });
    }
  }

  // Milestone freezes: every 7-day streak grants +1 freeze (max 3)
  if (
    streak.currentStreak > 0 &&
    streak.currentStreak % 7 === 0 &&
    profile.lastCompletionDate !== args.today
  ) {
    const refreshed = await ctx.db.get("studentGamification", profile._id);
    if (refreshed && refreshed.streakFreezes < 3) {
      await ctx.db.patch("studentGamification", profile._id, {
        streakFreezes: Math.min(3, refreshed.streakFreezes + 1),
        updatedAt: Date.now(),
      });
    }
  }

  return {
    xpGained: xpGain,
    pointsGained: pointsGain,
    starsGained: starsGain,
    leveledUp: level > previousLevel,
    previousLevel,
    newLevel: level,
    levelTitle: levelTitle(level),
    streak: streak.currentStreak,
    streakBroke: streak.streakBroke,
    freezeUsed: streak.freezeUsed,
    comebackBonus: streak.comebackBonus,
    newBadges: awardedBadgeSummaries,
  };
}

async function bumpDailyQuests(
  ctx: MutationCtx,
  args: {
    studentId: Id<"students">;
    familyId: Id<"families">;
    today: string;
    minutes: number;
    chores: number;
    stars: number;
  },
): Promise<void> {
  const quests = await ensureDailyQuests(
    ctx,
    args.studentId,
    args.familyId,
    args.today,
  );
  for (const q of quests) {
    if (q.completed) continue;
    let add = 0;
    if (q.questKey === "log_30_min") add = args.minutes;
    else if (q.questKey === "complete_chore") add = args.chores;
    else if (q.questKey === "earn_2_stars") add = args.stars;
    if (add <= 0) continue;
    const next = Math.min(q.targetValue, q.currentValue + add);
    const completed = next >= q.targetValue;
    await ctx.db.patch("dailyQuests", q._id, {
      currentValue: next,
      completed,
      claimedAt: completed && !q.claimedAt ? Date.now() : q.claimedAt,
    });
    if (completed && !q.completed) {
      await awardProgress(ctx, {
        studentId: args.studentId,
        familyId: args.familyId,
        today: args.today,
        xp: q.xpReward,
        points: q.pointsReward,
        stars: 0,
        source: "quest",
        skipQuests: true,
        skipStreak: true,
      });
    }
  }
}

export async function ensureDailyQuests(
  ctx: MutationCtx,
  studentId: Id<"students">,
  familyId: Id<"families">,
  today: string,
): Promise<Doc<"dailyQuests">[]> {
  const existing = await ctx.db
    .query("dailyQuests")
    .withIndex("by_student_and_date", (q) =>
      q.eq("studentId", studentId).eq("date", today),
    )
    .collect();
  if (existing.length > 0) return existing;

  const created: Doc<"dailyQuests">[] = [];
  for (const def of DEFAULT_QUESTS) {
    const id = await ctx.db.insert("dailyQuests", {
      studentId,
      familyId,
      date: today,
      questKey: def.questKey,
      title: def.title,
      description: def.description,
      targetValue: def.targetValue,
      currentValue: 0,
      completed: false,
      xpReward: def.xpReward,
      pointsReward: def.pointsReward,
      createdAt: Date.now(),
    });
    const doc = await ctx.db.get("dailyQuests", id);
    if (doc) created.push(doc);
  }
  return created;
}

export function rewardsForLog(durationMinutes: number): {
  xp: number;
  points: number;
  stars: number;
} {
  const mins = Math.max(1, durationMinutes);
  return {
    xp: 10 + Math.floor(mins / 10) * 2,
    points: 5 + Math.floor(mins / 15),
    stars: mins >= 60 ? 2 : 1,
  };
}

export function rewardsForChore(chore: {
  xpReward?: number;
  pointsReward?: number;
  starsReward?: number;
}): { xp: number; points: number; stars: number } {
  return {
    xp: chore.xpReward ?? 15,
    points: chore.pointsReward ?? 10,
    stars: chore.starsReward ?? 1,
  };
}

export async function deleteGamificationForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const profiles = await ctx.db
    .query("studentGamification")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const p of profiles) {
    await ctx.db.delete("studentGamification", p._id);
  }

  const badges = await ctx.db
    .query("studentBadges")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const b of badges) {
    await ctx.db.delete("studentBadges", b._id);
  }

  const accolades = await ctx.db
    .query("accolades")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const a of accolades) {
    await ctx.db.delete("accolades", a._id);
  }

  const redemptions = await ctx.db
    .query("rewardRedemptions")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const r of redemptions) {
    await ctx.db.delete("rewardRedemptions", r._id);
  }

  const quests = await ctx.db
    .query("dailyQuests")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const q of quests) {
    await ctx.db.delete("dailyQuests", q._id);
  }

  const chores = await ctx.db
    .query("chores")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const c of chores) {
    await ctx.db.delete("chores", c._id);
  }
}

export async function deleteRewardsForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const rewards = await ctx.db
    .query("rewardCatalog")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const r of rewards) {
    const redemptions = await ctx.db
      .query("rewardRedemptions")
      .withIndex("by_reward", (q) => q.eq("rewardId", r._id))
      .collect();
    for (const red of redemptions) {
      await ctx.db.delete("rewardRedemptions", red._id);
    }
    await ctx.db.delete("rewardCatalog", r._id);
  }

  const chores = await ctx.db
    .query("chores")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const c of chores) {
    await ctx.db.delete("chores", c._id);
  }
}
