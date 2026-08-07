import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { alertFamily, alertStudent } from "./lib/alerts";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireFamilyReadAccess,
  requireRole,
  requireStudentFamilyAccess,
} from "./lib/auth";
import { createFeedPost } from "./lib/feed";
import {
  awardProgress,
  ensureDailyQuests,
  getOrCreateGamification,
  levelFromXp,
  levelTitle,
  XP_PER_LEVEL,
  xpProgressInLevel,
} from "./lib/gamificationCore";

const badgeCriteriaValidator = v.union(
  v.literal("logs_count"),
  v.literal("streak"),
  v.literal("stars"),
  v.literal("chores_completed"),
  v.literal("minutes_logged"),
  v.literal("subjects_explored"),
  v.literal("level"),
  v.literal("manual"),
);

const badgeDocValidator = v.object({
  _id: v.id("badges"),
  _creationTime: v.number(),
  key: v.string(),
  title: v.string(),
  description: v.string(),
  iconKey: v.optional(v.string()),
  xpReward: v.optional(v.number()),
  pointsReward: v.optional(v.number()),
  criteriaType: badgeCriteriaValidator,
  criteriaValue: v.optional(v.number()),
  familyId: v.optional(v.id("families")),
  ageBand: v.optional(v.string()),
  source: v.optional(
    v.union(v.literal("system"), v.literal("ai"), v.literal("manual")),
  ),
  criteriaSummary: v.optional(v.string()),
  createdAt: v.number(),
});

const gamificationDocValidator = v.object({
  _id: v.id("studentGamification"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  familyId: v.id("families"),
  xp: v.number(),
  level: v.number(),
  points: v.number(),
  stars: v.number(),
  currentStreak: v.number(),
  longestStreak: v.number(),
  lastCompletionDate: v.optional(v.string()),
  streakFreezes: v.number(),
  weeklyXp: v.number(),
  weeklyPoints: v.number(),
  weeklyStars: v.number(),
  weekStart: v.optional(v.string()),
  totalLogs: v.number(),
  totalChoresCompleted: v.number(),
  totalMinutesLogged: v.number(),
  distinctSubjectsLogged: v.number(),
  updatedAt: v.number(),
});

const accoladeDocValidator = v.object({
  _id: v.id("accolades"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  familyId: v.id("families"),
  title: v.string(),
  message: v.optional(v.string()),
  awardedBy: v.id("users"),
  bonusStars: v.optional(v.number()),
  bonusPoints: v.optional(v.number()),
  createdAt: v.number(),
});

const rewardDocValidator = v.object({
  _id: v.id("rewardCatalog"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  title: v.string(),
  description: v.optional(v.string()),
  costPoints: v.number(),
  active: v.boolean(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

const redemptionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
);

const redemptionDocValidator = v.object({
  _id: v.id("rewardRedemptions"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  studentId: v.id("students"),
  rewardId: v.id("rewardCatalog"),
  costPoints: v.number(),
  status: redemptionStatusValidator,
  redeemedAt: v.number(),
  fulfilledAt: v.optional(v.number()),
  fulfilledBy: v.optional(v.id("users")),
  notes: v.optional(v.string()),
});

const questDocValidator = v.object({
  _id: v.id("dailyQuests"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  familyId: v.id("families"),
  date: v.string(),
  questKey: v.string(),
  title: v.string(),
  description: v.string(),
  targetValue: v.number(),
  currentValue: v.number(),
  completed: v.boolean(),
  xpReward: v.number(),
  pointsReward: v.number(),
  claimedAt: v.optional(v.number()),
  createdAt: v.number(),
});

const DEFAULT_BADGES: Array<{
  key: string;
  title: string;
  description: string;
  iconKey: string;
  criteriaType:
    | "logs_count"
    | "streak"
    | "stars"
    | "chores_completed"
    | "minutes_logged"
    | "subjects_explored"
    | "level"
    | "manual";
  criteriaValue: number;
  xpReward: number;
  pointsReward: number;
}> = [
  {
    key: "first_log",
    title: "First Steps",
    description: "Complete your first learning log.",
    iconKey: "spark",
    criteriaType: "logs_count",
    criteriaValue: 1,
    xpReward: 10,
    pointsReward: 5,
  },
  {
    key: "ten_logs",
    title: "Steady Learner",
    description: "Log learning 10 times.",
    iconKey: "book",
    criteriaType: "logs_count",
    criteriaValue: 10,
    xpReward: 25,
    pointsReward: 15,
  },
  {
    key: "streak_3",
    title: "On a Roll",
    description: "Keep a 3-day completion streak.",
    iconKey: "flame",
    criteriaType: "streak",
    criteriaValue: 3,
    xpReward: 15,
    pointsReward: 10,
  },
  {
    key: "streak_7",
    title: "Week Warrior",
    description: "Maintain a 7-day streak.",
    iconKey: "flame",
    criteriaType: "streak",
    criteriaValue: 7,
    xpReward: 40,
    pointsReward: 25,
  },
  {
    key: "stars_10",
    title: "Rising Star",
    description: "Earn 10 stars.",
    iconKey: "star",
    criteriaType: "stars",
    criteriaValue: 10,
    xpReward: 20,
    pointsReward: 10,
  },
  {
    key: "stars_50",
    title: "Constellation",
    description: "Earn 50 stars.",
    iconKey: "star",
    criteriaType: "stars",
    criteriaValue: 50,
    xpReward: 50,
    pointsReward: 30,
  },
  {
    key: "chores_5",
    title: "Helping Hand",
    description: "Complete 5 chores.",
    iconKey: "check",
    criteriaType: "chores_completed",
    criteriaValue: 5,
    xpReward: 20,
    pointsReward: 15,
  },
  {
    key: "chores_10",
    title: "Responsibility Pro",
    description: "Complete 10 chores.",
    iconKey: "check",
    criteriaType: "chores_completed",
    criteriaValue: 10,
    xpReward: 35,
    pointsReward: 25,
  },
  {
    key: "minutes_120",
    title: "Deep Focus",
    description: "Log 120 total minutes of learning.",
    iconKey: "clock",
    criteriaType: "minutes_logged",
    criteriaValue: 120,
    xpReward: 30,
    pointsReward: 20,
  },
  {
    key: "subjects_3",
    title: "Subject Explorer",
    description: "Log work across 3 different subjects.",
    iconKey: "compass",
    criteriaType: "subjects_explored",
    criteriaValue: 3,
    xpReward: 25,
    pointsReward: 15,
  },
  {
    key: "level_5",
    title: "Scholar Rising",
    description: "Reach level 5.",
    iconKey: "medal",
    criteriaType: "level",
    criteriaValue: 5,
    xpReward: 40,
    pointsReward: 20,
  },
  {
    key: "parent_pride",
    title: "Parent's Pride",
    description: "Manually awarded for exceptional effort.",
    iconKey: "heart",
    criteriaType: "manual",
    criteriaValue: 1,
    xpReward: 0,
    pointsReward: 0,
  },
];

// ── Profile / dashboard ─────────────────────────────────────────

export const getStudentProfile = query({
  args: { studentId: v.id("students") },
  returns: v.union(
    v.object({
      profile: gamificationDocValidator,
      levelTitle: v.string(),
      xpIntoLevel: v.number(),
      xpNeeded: v.number(),
      xpRatio: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const profile = await ctx.db
      .query("studentGamification")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .unique();
    if (!profile) return null;
    const progress = xpProgressInLevel(profile.xp);
    return {
      profile,
      levelTitle: levelTitle(profile.level),
      xpIntoLevel: progress.intoLevel,
      xpNeeded: progress.needed,
      xpRatio: progress.ratio,
    };
  },
});

export const ensureStudentProfile = mutation({
  args: { studentId: v.id("students") },
  returns: v.id("studentGamification"),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const profile = await getOrCreateGamification(
      ctx,
      student._id,
      student.familyId,
    );
    return profile._id;
  },
});

export const listFamilySummaries = query({
  args: { familyId: v.id("families") },
  returns: v.array(
    v.object({
      studentId: v.id("students"),
      displayName: v.string(),
      xp: v.number(),
      level: v.number(),
      levelTitle: v.string(),
      points: v.number(),
      stars: v.number(),
      currentStreak: v.number(),
      longestStreak: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const students = await ctx.db
      .query("students")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    const out = [];
    for (const s of students) {
      const g = await ctx.db
        .query("studentGamification")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .unique();
      out.push({
        studentId: s._id,
        displayName: s.displayName,
        xp: g?.xp ?? 0,
        level: g?.level ?? 1,
        levelTitle: levelTitle(g?.level ?? 1),
        points: g?.points ?? 0,
        stars: g?.stars ?? 0,
        currentStreak: g?.currentStreak ?? 0,
        longestStreak: g?.longestStreak ?? 0,
      });
    }
    return out.sort((a, b) => b.xp - a.xp);
  },
});

export const familyLeaderboard = query({
  args: {
    familyId: v.id("families"),
    weekStart: v.string(),
    sortBy: v.optional(
      v.union(v.literal("xp"), v.literal("points"), v.literal("stars")),
    ),
  },
  returns: v.array(
    v.object({
      studentId: v.id("students"),
      displayName: v.string(),
      weeklyXp: v.number(),
      weeklyPoints: v.number(),
      weeklyStars: v.number(),
      xp: v.number(),
      points: v.number(),
      stars: v.number(),
      level: v.number(),
      levelTitle: v.string(),
      rank: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyReadAccess(ctx, args.familyId);
    const sortBy = args.sortBy ?? "xp";
    const students = await ctx.db
      .query("students")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    const rows = [];
    for (const s of students) {
      const g = await ctx.db
        .query("studentGamification")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .unique();
      const sameWeek = g?.weekStart === args.weekStart;
      rows.push({
        studentId: s._id,
        displayName: s.displayName,
        weeklyXp: sameWeek ? (g?.weeklyXp ?? 0) : 0,
        weeklyPoints: sameWeek ? (g?.weeklyPoints ?? 0) : 0,
        weeklyStars: sameWeek ? (g?.weeklyStars ?? 0) : 0,
        xp: g?.xp ?? 0,
        points: g?.points ?? 0,
        stars: g?.stars ?? 0,
        level: g?.level ?? 1,
        levelTitle: levelTitle(g?.level ?? 1),
      });
    }

    rows.sort((a, b) => {
      if (sortBy === "points") return b.weeklyPoints - a.weeklyPoints;
      if (sortBy === "stars") return b.weeklyStars - a.weeklyStars;
      return b.weeklyXp - a.weeklyXp;
    });

    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  },
});

// ── Badges CRUD ─────────────────────────────────────────────────

export const listBadges = query({
  args: {},
  returns: v.array(badgeDocValidator),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.db.query("badges").collect();
  },
});

export const listStudentBadges = query({
  args: { studentId: v.id("students") },
  returns: v.array(
    v.object({
      earned: v.object({
        _id: v.id("studentBadges"),
        badgeId: v.id("badges"),
        earnedAt: v.number(),
      }),
      badge: badgeDocValidator,
    }),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const earned = await ctx.db
      .query("studentBadges")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const out = [];
    for (const e of earned) {
      const badge = await ctx.db.get("badges", e.badgeId);
      if (badge) {
        out.push({
          earned: {
            _id: e._id,
            badgeId: e.badgeId,
            earnedAt: e.earnedAt,
          },
          badge,
        });
      }
    }
    return out.sort((a, b) => b.earned.earnedAt - a.earned.earnedAt);
  },
});

export const createBadge = mutation({
  args: {
    key: v.string(),
    title: v.string(),
    description: v.string(),
    iconKey: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsReward: v.optional(v.number()),
    criteriaType: badgeCriteriaValidator,
    criteriaValue: v.optional(v.number()),
    familyId: v.optional(v.id("families")),
    ageBand: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("system"), v.literal("ai"), v.literal("manual")),
    ),
    criteriaSummary: v.optional(v.string()),
  },
  returns: v.id("badges"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "parent"]);
    const key = args.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) throw new Error("Badge key is required");
    const title = args.title.trim();
    if (!title) throw new Error("Badge title is required");

    if (args.familyId) {
      await requireFamilyAccess(ctx, args.familyId);
    }

    const existing = await ctx.db
      .query("badges")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) throw new Error("A badge with that key already exists");

    return await ctx.db.insert("badges", {
      key,
      title,
      description: args.description.trim(),
      iconKey: args.iconKey,
      xpReward: args.xpReward,
      pointsReward: args.pointsReward,
      criteriaType: args.criteriaType,
      criteriaValue: args.criteriaValue,
      familyId: args.familyId,
      ageBand: args.ageBand,
      source: args.source ?? (args.familyId ? "manual" : "system"),
      criteriaSummary: args.criteriaSummary,
      createdAt: Date.now(),
    });
  },
});

export const updateBadge = mutation({
  args: {
    badgeId: v.id("badges"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    iconKey: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsReward: v.optional(v.number()),
    criteriaType: v.optional(badgeCriteriaValidator),
    criteriaValue: v.optional(v.number()),
    ageBand: v.optional(v.string()),
    criteriaSummary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "parent"]);
    const badge = await ctx.db.get("badges", args.badgeId);
    if (!badge) throw new Error("Badge not found");
    if (badge.familyId) {
      await requireFamilyAccess(ctx, badge.familyId);
    }

    const patch: {
      title?: string;
      description?: string;
      iconKey?: string;
      xpReward?: number;
      pointsReward?: number;
      criteriaType?: typeof args.criteriaType;
      criteriaValue?: number;
      ageBand?: string;
      criteriaSummary?: string;
    } = {};
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Badge title is required");
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim();
    }
    if (args.iconKey !== undefined) patch.iconKey = args.iconKey;
    if (args.xpReward !== undefined) patch.xpReward = args.xpReward;
    if (args.pointsReward !== undefined) patch.pointsReward = args.pointsReward;
    if (args.criteriaType !== undefined) patch.criteriaType = args.criteriaType;
    if (args.criteriaValue !== undefined) {
      patch.criteriaValue = args.criteriaValue;
    }
    if (args.ageBand !== undefined) patch.ageBand = args.ageBand;
    if (args.criteriaSummary !== undefined) {
      patch.criteriaSummary = args.criteriaSummary;
    }

    await ctx.db.patch("badges", args.badgeId, patch);
    return null;
  },
});

export const removeBadge = mutation({
  args: { badgeId: v.id("badges") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["superAdmin", "parent"]);
    const badge = await ctx.db.get("badges", args.badgeId);
    if (!badge) throw new Error("Badge not found");

    if (badge.familyId) {
      await requireFamilyAccess(ctx, badge.familyId);
    } else if (user.role !== "superAdmin") {
      throw new Error("Only superAdmin can remove system badges");
    }

    const earned = await ctx.db
      .query("studentBadges")
      .withIndex("by_badge", (q) => q.eq("badgeId", args.badgeId))
      .collect();
    for (const e of earned) {
      await ctx.db.delete("studentBadges", e._id);
    }
    await ctx.db.delete("badges", args.badgeId);
    return null;
  },
});

export const seedBadges = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireRole(ctx, ["superAdmin", "parent"]);
    let created = 0;
    for (const def of DEFAULT_BADGES) {
      const existing = await ctx.db
        .query("badges")
        .withIndex("by_key", (q) => q.eq("key", def.key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("badges", {
        ...def,
        createdAt: Date.now(),
      });
      created += 1;
    }
    return created;
  },
});

export const grantManualBadge = mutation({
  args: {
    studentId: v.id("students"),
    badgeId: v.id("badges"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can grant badges");
    }
    const badge = await ctx.db.get("badges", args.badgeId);
    if (!badge) throw new Error("Badge not found");

    const existing = await ctx.db
      .query("studentBadges")
      .withIndex("by_student_and_badge", (q) =>
        q.eq("studentId", args.studentId).eq("badgeId", args.badgeId),
      )
      .unique();
    if (existing) throw new Error("Student already has this badge");

    await ctx.db.insert("studentBadges", {
      studentId: args.studentId,
      badgeId: args.badgeId,
      earnedAt: Date.now(),
      createdAt: Date.now(),
    });

    if ((badge.xpReward ?? 0) > 0 || (badge.pointsReward ?? 0) > 0) {
      const today = new Date().toISOString().slice(0, 10);
      await awardProgress(ctx, {
        studentId: student._id,
        familyId: student.familyId,
        today,
        xp: badge.xpReward ?? 0,
        points: badge.pointsReward ?? 0,
        stars: 0,
        source: "badge",
        skipQuests: true,
        skipStreak: true,
      });
    }
    return null;
  },
});

// ── Accolades CRUD ──────────────────────────────────────────────

export const listAccolades = query({
  args: {
    studentId: v.id("students"),
    limit: v.optional(v.number()),
  },
  returns: v.array(accoladeDocValidator),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const limit = Math.min(args.limit ?? 20, 50);
    const rows = await ctx.db
      .query("accolades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(limit);
    return rows;
  },
});

export const createAccolade = mutation({
  args: {
    studentId: v.id("students"),
    title: v.string(),
    message: v.optional(v.string()),
    bonusStars: v.optional(v.number()),
    bonusPoints: v.optional(v.number()),
    today: v.string(),
  },
  returns: v.id("accolades"),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can grant accolades");
    }
    const title = args.title.trim();
    if (!title) throw new Error("Accolade title is required");

    const id = await ctx.db.insert("accolades", {
      studentId: args.studentId,
      familyId: student.familyId,
      title,
      message: args.message?.trim() || undefined,
      awardedBy: user._id,
      bonusStars: args.bonusStars,
      bonusPoints: args.bonusPoints,
      createdAt: Date.now(),
    });

    const stars = Math.max(0, args.bonusStars ?? 1);
    const points = Math.max(0, args.bonusPoints ?? 5);
    await awardProgress(ctx, {
      studentId: student._id,
      familyId: student.familyId,
      today: args.today,
      xp: 10,
      points,
      stars,
      source: "accolade",
    });

    await alertStudent(ctx, {
      studentId: student._id,
      type: "accolade_awarded",
      title: "New accolade!",
      body: `You earned “${title}”${args.message ? `: ${args.message.trim()}` : ""}.`,
      href: "/student/dashboard",
      createdBy: user._id,
      sourceTable: "accolades",
      sourceId: id,
    });

    await createFeedPost(ctx, {
      familyId: student.familyId,
      type: "accolade",
      actorStudentId: student._id,
      targetStudentId: student._id,
      title: `${student.displayName} earned an accolade: ${title}`,
      body: args.message?.trim() || undefined,
      href: "/student/dashboard",
      sourceTable: "accolades",
      sourceId: id,
      createdByUserId: user._id,
    });

    return id;
  },
});

export const updateAccolade = mutation({
  args: {
    accoladeId: v.id("accolades"),
    title: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const accolade = await ctx.db.get("accolades", args.accoladeId);
    if (!accolade) throw new Error("Accolade not found");
    const { user } = await requireStudentFamilyAccess(ctx, accolade.studentId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can edit accolades");
    }
    const patch: { title?: string; message?: string } = {};
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.message !== undefined) {
      patch.message = args.message.trim() || undefined;
    }
    await ctx.db.patch("accolades", args.accoladeId, patch);
    return null;
  },
});

export const removeAccolade = mutation({
  args: { accoladeId: v.id("accolades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const accolade = await ctx.db.get("accolades", args.accoladeId);
    if (!accolade) throw new Error("Accolade not found");
    const { user } = await requireStudentFamilyAccess(ctx, accolade.studentId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can delete accolades");
    }
    await ctx.db.delete("accolades", args.accoladeId);
    return null;
  },
});

export const grantBonus = mutation({
  args: {
    studentId: v.id("students"),
    points: v.optional(v.number()),
    stars: v.optional(v.number()),
    xp: v.optional(v.number()),
    today: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can grant bonuses");
    }
    await awardProgress(ctx, {
      studentId: student._id,
      familyId: student.familyId,
      today: args.today,
      xp: Math.max(0, args.xp ?? 0),
      points: Math.max(0, args.points ?? 0),
      stars: Math.max(0, args.stars ?? 0),
      source: "bonus",
    });
    return null;
  },
});

// ── Rewards shop CRUD ───────────────────────────────────────────

export const listRewards = query({
  args: {
    familyId: v.id("families"),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(rewardDocValidator),
  handler: async (ctx, args) => {
    await requireFamilyReadAccess(ctx, args.familyId);
    if (args.activeOnly) {
      return await ctx.db
        .query("rewardCatalog")
        .withIndex("by_family_and_active", (q) =>
          q.eq("familyId", args.familyId).eq("active", true),
        )
        .collect();
    }
    return await ctx.db
      .query("rewardCatalog")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();
  },
});

export const createReward = mutation({
  args: {
    familyId: v.id("families"),
    title: v.string(),
    description: v.optional(v.string()),
    costPoints: v.number(),
  },
  returns: v.id("rewardCatalog"),
  handler: async (ctx, args) => {
    const { user } = await requireFamilyAccess(ctx, args.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can create rewards");
    }
    const title = args.title.trim();
    if (!title) throw new Error("Reward title is required");
    if (args.costPoints <= 0) throw new Error("Cost must be greater than 0");

    return await ctx.db.insert("rewardCatalog", {
      familyId: args.familyId,
      title,
      description: args.description?.trim() || undefined,
      costPoints: args.costPoints,
      active: true,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const updateReward = mutation({
  args: {
    rewardId: v.id("rewardCatalog"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    costPoints: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reward = await ctx.db.get("rewardCatalog", args.rewardId);
    if (!reward) throw new Error("Reward not found");
    const { user } = await requireFamilyAccess(ctx, reward.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can update rewards");
    }

    const patch: {
      title?: string;
      description?: string;
      costPoints?: number;
      active?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.costPoints !== undefined) {
      if (args.costPoints <= 0) throw new Error("Cost must be greater than 0");
      patch.costPoints = args.costPoints;
    }
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch("rewardCatalog", args.rewardId, patch);
    return null;
  },
});

export const removeReward = mutation({
  args: { rewardId: v.id("rewardCatalog") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reward = await ctx.db.get("rewardCatalog", args.rewardId);
    if (!reward) throw new Error("Reward not found");
    const { user } = await requireFamilyAccess(ctx, reward.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can delete rewards");
    }
    const pending = await ctx.db
      .query("rewardRedemptions")
      .withIndex("by_reward", (q) => q.eq("rewardId", args.rewardId))
      .collect();
    for (const r of pending) {
      if (r.status === "pending") {
        // Refund points
        const g = await ctx.db
          .query("studentGamification")
          .withIndex("by_student", (q) => q.eq("studentId", r.studentId))
          .unique();
        if (g) {
          await ctx.db.patch("studentGamification", g._id, {
            points: g.points + r.costPoints,
            updatedAt: Date.now(),
          });
        }
      }
      await ctx.db.delete("rewardRedemptions", r._id);
    }
    await ctx.db.delete("rewardCatalog", args.rewardId);
    return null;
  },
});

export const redeemReward = mutation({
  args: {
    rewardId: v.id("rewardCatalog"),
    studentId: v.id("students"),
  },
  returns: v.id("rewardRedemptions"),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    const reward = await ctx.db.get("rewardCatalog", args.rewardId);
    if (!reward || !reward.active) throw new Error("Reward not available");
    if (reward.familyId !== student.familyId) {
      throw new Error("Reward is not in this family");
    }

    const profile = await getOrCreateGamification(
      ctx,
      student._id,
      student.familyId,
    );
    if (profile.points < reward.costPoints) {
      throw new Error("Not enough points");
    }

    await ctx.db.patch("studentGamification", profile._id, {
      points: profile.points - reward.costPoints,
      updatedAt: Date.now(),
    });

    const id = await ctx.db.insert("rewardRedemptions", {
      familyId: student.familyId,
      studentId: student._id,
      rewardId: reward._id,
      costPoints: reward.costPoints,
      status: "pending",
      redeemedAt: Date.now(),
    });

    await alertFamily(ctx, {
      familyId: student.familyId,
      studentId: student._id,
      type: "reward_redeemed",
      title: "Reward redemption",
      body: `${student.displayName} redeemed “${reward.title}” for ${reward.costPoints} points.`,
      href: "/family/chores?tab=rewards",
      createdBy: user._id,
      sourceTable: "rewardRedemptions",
      sourceId: id,
    });

    return id;
  },
});

export const listRedemptions = query({
  args: {
    familyId: v.id("families"),
    status: v.optional(redemptionStatusValidator),
  },
  returns: v.array(
    v.object({
      redemption: redemptionDocValidator,
      rewardTitle: v.string(),
      studentName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    let rows;
    if (args.status) {
      rows = await ctx.db
        .query("rewardRedemptions")
        .withIndex("by_family_and_status", (q) =>
          q.eq("familyId", args.familyId).eq("status", args.status!),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("rewardRedemptions")
        .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
        .collect();
    }

    const out = [];
    for (const r of rows) {
      const reward = await ctx.db.get("rewardCatalog", r.rewardId);
      const student = await ctx.db.get("students", r.studentId);
      out.push({
        redemption: r,
        rewardTitle: reward?.title ?? "Reward",
        studentName: student?.displayName ?? "Student",
      });
    }
    return out.sort(
      (a, b) => b.redemption.redeemedAt - a.redemption.redeemedAt,
    );
  },
});

export const listMyRedemptions = query({
  args: { studentId: v.id("students") },
  returns: v.array(
    v.object({
      redemption: redemptionDocValidator,
      rewardTitle: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const rows = await ctx.db
      .query("rewardRedemptions")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const out = [];
    for (const r of rows) {
      const reward = await ctx.db.get("rewardCatalog", r.rewardId);
      out.push({
        redemption: r,
        rewardTitle: reward?.title ?? "Reward",
      });
    }
    return out.sort(
      (a, b) => b.redemption.redeemedAt - a.redemption.redeemedAt,
    );
  },
});

export const fulfillRedemption = mutation({
  args: {
    redemptionId: v.id("rewardRedemptions"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const redemption = await ctx.db.get(
      "rewardRedemptions",
      args.redemptionId,
    );
    if (!redemption) throw new Error("Redemption not found");
    const { user } = await requireFamilyAccess(ctx, redemption.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can fulfill rewards");
    }
    if (redemption.status !== "pending") {
      throw new Error("Redemption is not pending");
    }
    await ctx.db.patch("rewardRedemptions", args.redemptionId, {
      status: "fulfilled",
      fulfilledAt: Date.now(),
      fulfilledBy: user._id,
      notes: args.notes?.trim() || undefined,
    });
    return null;
  },
});

export const cancelRedemption = mutation({
  args: { redemptionId: v.id("rewardRedemptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const redemption = await ctx.db.get(
      "rewardRedemptions",
      args.redemptionId,
    );
    if (!redemption) throw new Error("Redemption not found");
    const { user } = await requireFamilyAccess(ctx, redemption.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can cancel redemptions");
    }
    if (redemption.status !== "pending") {
      throw new Error("Redemption is not pending");
    }

    const g = await ctx.db
      .query("studentGamification")
      .withIndex("by_student", (q) => q.eq("studentId", redemption.studentId))
      .unique();
    if (g) {
      await ctx.db.patch("studentGamification", g._id, {
        points: g.points + redemption.costPoints,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch("rewardRedemptions", args.redemptionId, {
      status: "cancelled",
      fulfilledAt: Date.now(),
      fulfilledBy: user._id,
    });
    return null;
  },
});

export const removeRedemption = mutation({
  args: { redemptionId: v.id("rewardRedemptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const redemption = await ctx.db.get(
      "rewardRedemptions",
      args.redemptionId,
    );
    if (!redemption) throw new Error("Redemption not found");
    const { user } = await requireFamilyAccess(ctx, redemption.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can delete redemption records");
    }
    if (redemption.status === "pending") {
      throw new Error("Cancel the pending redemption first");
    }
    await ctx.db.delete("rewardRedemptions", args.redemptionId);
    return null;
  },
});

// ── Daily quests ────────────────────────────────────────────────

export const listDailyQuests = query({
  args: {
    studentId: v.id("students"),
    today: v.string(),
  },
  returns: v.array(questDocValidator),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    return await ctx.db
      .query("dailyQuests")
      .withIndex("by_student_and_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", args.today),
      )
      .collect();
  },
});

export const ensureQuestsForToday = mutation({
  args: {
    studentId: v.id("students"),
    today: v.string(),
  },
  returns: v.array(v.id("dailyQuests")),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    await getOrCreateGamification(ctx, student._id, student.familyId);
    const quests = await ensureDailyQuests(
      ctx,
      student._id,
      student.familyId,
      args.today,
    );
    return quests.map((q) => q._id);
  },
});

export const rulesSummary = query({
  args: {},
  returns: v.object({
    xpPerLevel: v.number(),
    levelTitles: v.array(v.object({ minLevel: v.number(), title: v.string() })),
    pointsVsXp:
      v.string(),
    streakNotes: v.string(),
  }),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return {
      xpPerLevel: XP_PER_LEVEL,
      levelTitles: [
        { minLevel: 1, title: "Novice" },
        { minLevel: 3, title: "Apprentice" },
        { minLevel: 5, title: "Explorer" },
        { minLevel: 8, title: "Scholar" },
        { minLevel: 12, title: "Adept" },
        { minLevel: 16, title: "Sage" },
        { minLevel: 20, title: "Master" },
        { minLevel: 25, title: "Luminary" },
      ],
      pointsVsXp:
        "XP permanently raises your level. Points are spendable currency for the family rewards shop. Stars are prestige.",
      streakNotes:
        "Complete at least one qualifying action each calendar day to grow your streak. Missing one day spends a streak freeze if you have one; otherwise the streak resets. Returning after a 3+ day streak grants a small comeback bonus. Every 7 streak days earns another freeze (max 3).",
    };
  },
});

/** Resolve family for current parent — helper used by UI pages. */
export const myFamilyId = query({
  args: {},
  returns: v.union(v.id("families"), v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const family = await getPrimaryFamilyForUser(ctx, user._id);
    return family?._id ?? null;
  },
});

export { levelFromXp, levelTitle, XP_PER_LEVEL };
