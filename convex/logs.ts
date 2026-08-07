import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { alertFamily, alertStudent } from "./lib/alerts";
import { getCurrentUser, requireStudentFamilyAccess } from "./lib/auth";
import { entryTypeValidator, logDocValidator } from "./lib/validators";
import {
  awardProgress,
  reapplyAwardsForSource,
  reverseAwardsForSource,
  rewardsForLog,
} from "./lib/gamificationCore";

/** Legacy docs without status are treated as active. */
function isLogActive(log: Doc<"logs">): boolean {
  return log.status !== "nullified";
}

function requireParentOrAdmin(user: Doc<"users">) {
  if (user.role !== "parent" && user.role !== "superAdmin") {
    throw new Error("Only parents can perform this action");
  }
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    studentId: v.id("students"),
    courseId: v.optional(v.id("courses")),
    subjectId: v.optional(v.id("subjects")),
    entryType: entryTypeValidator,
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    today: v.optional(v.string()),
    weekStart: v.optional(v.string()),
  },
  returns: v.id("logs"),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );

    if (args.durationMinutes <= 0) {
      throw new Error("Duration must be greater than 0");
    }

    if (args.courseId) {
      const course = await ctx.db.get("courses", args.courseId);
      if (!course) {
        throw new Error("Course not found");
      }
    }

    let resolvedSubjectId = args.subjectId;
    if (args.subjectId) {
      const subject = await ctx.db.get("subjects", args.subjectId);
      if (!subject) {
        throw new Error("Subject not found");
      }
    } else if (args.courseId) {
      const course = await ctx.db.get("courses", args.courseId);
      if (course) resolvedSubjectId = course.subjectId;
    }

    const logId = await ctx.db.insert("logs", {
      studentId: args.studentId,
      courseId: args.courseId,
      subjectId: resolvedSubjectId,
      entryType: args.entryType,
      durationMinutes: args.durationMinutes,
      notes: args.notes?.trim() || undefined,
      storageId: args.storageId,
      verifiedByParent: false,
      createdBy: user._id,
      createdAt: Date.now(),
      status: "active",
    });

    await alertFamily(ctx, {
      familyId: student.familyId,
      studentId: student._id,
      type: "log_created",
      title: "Learning log added",
      body: `${student.displayName} logged ${args.durationMinutes} minutes (${args.entryType.replaceAll("_", " ")}).`,
      href: `/family/students/${student._id}?tab=logs`,
      createdBy: user._id,
      sourceTable: "logs",
      sourceId: logId,
    });

    const today = args.today ?? new Date().toISOString().slice(0, 10);
    const rewards = rewardsForLog(args.durationMinutes);

    let newSubject = false;
    if (resolvedSubjectId) {
      const priorWithSubject = await ctx.db
        .query("logs")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect();
      const otherSubjects = new Set(
        priorWithSubject
          .filter((l) => l._id !== logId && l.subjectId && isLogActive(l))
          .map((l) => l.subjectId as string),
      );
      newSubject = !otherSubjects.has(resolvedSubjectId);
    }

    await awardProgress(ctx, {
      studentId: student._id,
      familyId: student.familyId,
      today,
      weekStart: args.weekStart,
      xp: rewards.xp,
      points: rewards.points,
      stars: rewards.stars,
      source: "log",
      sourceId: logId,
      logIncrement: 1,
      minutesIncrement: args.durationMinutes,
      newSubject,
    });

    return logId;
  },
});

export const listForStudent = query({
  args: {
    studentId: v.id("students"),
    limit: v.optional(v.number()),
  },
  returns: v.array(logDocValidator),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);

    const limit = Math.min(args.limit ?? 50, 100);
    return await ctx.db
      .query("logs")
      .withIndex("by_student_and_createdAt", (q) =>
        q.eq("studentId", args.studentId),
      )
      .order("desc")
      .take(limit);
  },
});

export const verify = mutation({
  args: { logId: v.id("logs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get("logs", args.logId);
    if (!log) {
      throw new Error("Log not found");
    }

    const { user } = await requireStudentFamilyAccess(ctx, log.studentId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can verify logs");
    }

    await ctx.db.patch("logs", args.logId, {
      verifiedByParent: true,
      verifiedBy: user._id,
    });

    await alertStudent(ctx, {
      studentId: log.studentId,
      type: "log_verified",
      title: "Log verified",
      body: `A parent verified your ${log.durationMinutes}-minute learning log.`,
      href: "/student/dashboard",
      createdBy: user._id,
      sourceTable: "logs",
      sourceId: args.logId,
    });

    return null;
  },
});

export const unverify = mutation({
  args: { logId: v.id("logs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get("logs", args.logId);
    if (!log) {
      throw new Error("Log not found");
    }

    const { user } = await requireStudentFamilyAccess(ctx, log.studentId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can unverify logs");
    }

    await ctx.db.patch("logs", args.logId, {
      verifiedByParent: false,
      verifiedBy: undefined,
    });
    return null;
  },
});

export const update = mutation({
  args: {
    logId: v.id("logs"),
    courseId: v.optional(v.id("courses")),
    subjectId: v.optional(v.id("subjects")),
    entryType: v.optional(entryTypeValidator),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get("logs", args.logId);
    if (!log) {
      throw new Error("Log not found");
    }

    const { user } = await requireStudentFamilyAccess(ctx, log.studentId);
    if (
      user.role !== "parent" &&
      user.role !== "superAdmin" &&
      log.createdBy !== user._id
    ) {
      throw new Error("Unauthorized to edit this log");
    }

    if (!isLogActive(log)) {
      throw new Error("Cannot edit a nullified log — restore it first");
    }

    const patch: {
      courseId?: typeof args.courseId;
      subjectId?: typeof args.subjectId;
      entryType?: typeof args.entryType;
      durationMinutes?: number;
      notes?: string;
      storageId?: Id<"_storage">;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.durationMinutes !== undefined) {
      if (args.durationMinutes <= 0) {
        throw new Error("Duration must be greater than 0");
      }
      patch.durationMinutes = args.durationMinutes;
    }
    if (args.entryType !== undefined) {
      patch.entryType = args.entryType;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    if (args.storageId !== undefined) {
      patch.storageId = args.storageId;
    }
    if (args.courseId !== undefined) {
      if (args.courseId) {
        const course = await ctx.db.get("courses", args.courseId);
        if (!course) throw new Error("Course not found");
      }
      patch.courseId = args.courseId;
    }
    if (args.subjectId !== undefined) {
      if (args.subjectId) {
        const subject = await ctx.db.get("subjects", args.subjectId);
        if (!subject) throw new Error("Subject not found");
      }
      patch.subjectId = args.subjectId;
    }

    await ctx.db.patch("logs", args.logId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { logId: v.id("logs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get("logs", args.logId);
    if (!log) {
      throw new Error("Log not found");
    }

    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      log.studentId,
    );
    if (
      user.role !== "parent" &&
      user.role !== "superAdmin" &&
      log.createdBy !== user._id
    ) {
      throw new Error("Unauthorized to delete this log");
    }

    // Reverse rewards if still active (nullified logs already reversed).
    if (isLogActive(log)) {
      const rewards = rewardsForLog(log.durationMinutes);
      await reverseAwardsForSource(ctx, {
        studentId: student._id,
        familyId: student.familyId,
        sourceType: "log",
        sourceId: args.logId,
        fallback: {
          xp: rewards.xp,
          points: rewards.points,
          stars: rewards.stars,
          logIncrement: 1,
          minutesIncrement: log.durationMinutes,
          awardDate: new Date(log.createdAt).toISOString().slice(0, 10),
        },
      });
    }

    const awardRows = await ctx.db
      .query("gamificationAwards")
      .withIndex("by_source", (q) =>
        q.eq("sourceType", "log").eq("sourceId", args.logId),
      )
      .collect();
    for (const row of awardRows) {
      await ctx.db.delete("gamificationAwards", row._id);
    }

    await ctx.db.delete("logs", args.logId);
    return null;
  },
});

/**
 * Soft-void a log for audit trail. Reverses XP/points/stars from the award
 * ledger (or synthesizes from duration for pre-ledger logs). Streak is left
 * unchanged; badges are revoked only when criteria are no longer met.
 */
export const nullify = mutation({
  args: {
    logId: v.id("logs"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get("logs", args.logId);
    if (!log) {
      throw new Error("Log not found");
    }

    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      log.studentId,
    );
    requireParentOrAdmin(user);

    if (!isLogActive(log)) {
      throw new Error("Log is already nullified");
    }

    const rewards = rewardsForLog(log.durationMinutes);
    await reverseAwardsForSource(ctx, {
      studentId: student._id,
      familyId: student.familyId,
      sourceType: "log",
      sourceId: args.logId,
      fallback: {
        xp: rewards.xp,
        points: rewards.points,
        stars: rewards.stars,
        logIncrement: 1,
        minutesIncrement: log.durationMinutes,
        awardDate: new Date(log.createdAt).toISOString().slice(0, 10),
      },
    });

    const reason = args.reason?.trim();
    await ctx.db.patch("logs", args.logId, {
      status: "nullified",
      nullifiedAt: Date.now(),
      nullifiedBy: user._id,
      nullifyReason: reason || undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const restore = mutation({
  args: {
    logId: v.id("logs"),
    today: v.optional(v.string()),
    weekStart: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get("logs", args.logId);
    if (!log) {
      throw new Error("Log not found");
    }

    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      log.studentId,
    );
    requireParentOrAdmin(user);

    if (isLogActive(log)) {
      throw new Error("Log is not nullified");
    }

    const today = args.today ?? new Date().toISOString().slice(0, 10);

    await reapplyAwardsForSource(ctx, {
      studentId: student._id,
      familyId: student.familyId,
      sourceType: "log",
      sourceId: args.logId,
      today,
      weekStart: args.weekStart,
    });

    await ctx.db.patch("logs", args.logId, {
      status: "active",
      nullifiedAt: undefined,
      nullifiedBy: undefined,
      nullifyReason: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const progressSummary = query({
  args: {
    studentId: v.id("students"),
    since: v.optional(v.number()),
  },
  returns: v.object({
    totalMinutes: v.number(),
    verifiedMinutes: v.number(),
    entryCount: v.number(),
    verifiedCount: v.number(),
    byEntryType: v.object({
      native_completion: v.number(),
      external_time: v.number(),
      manual: v.number(),
    }),
    recent: v.array(logDocValidator),
  }),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_student_and_createdAt", (q) =>
        q.eq("studentId", args.studentId),
      )
      .order("desc")
      .take(200);

    const filtered = (args.since
      ? logs.filter((l) => l.createdAt >= args.since!)
      : logs
    ).filter(isLogActive);

    let totalMinutes = 0;
    let verifiedMinutes = 0;
    let verifiedCount = 0;
    const byEntryType = {
      native_completion: 0,
      external_time: 0,
      manual: 0,
    };

    for (const log of filtered) {
      totalMinutes += log.durationMinutes;
      byEntryType[log.entryType] += log.durationMinutes;
      if (log.verifiedByParent) {
        verifiedMinutes += log.durationMinutes;
        verifiedCount += 1;
      }
    }

    return {
      totalMinutes,
      verifiedMinutes,
      entryCount: filtered.length,
      verifiedCount,
      byEntryType,
      recent: filtered.slice(0, 15),
    };
  },
});

function toDateKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function eachDateKey(since: number, until: number): string[] {
  const keys: string[] = [];
  const start = new Date(toDateKey(since) + "T00:00:00.000Z");
  const end = new Date(toDateKey(until) + "T00:00:00.000Z");
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function streakEndingOn(
  daysWithActivity: Set<string>,
  untilDateKey: string,
): number {
  let streak = 0;
  const cursor = new Date(untilDateKey + "T00:00:00.000Z");
  while (daysWithActivity.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export const progressChartData = query({
  args: {
    studentId: v.id("students"),
    since: v.number(),
    until: v.optional(v.number()),
  },
  returns: v.object({
    timeSeries: v.array(
      v.object({
        date: v.string(),
        minutes: v.number(),
        verifiedMinutes: v.number(),
      }),
    ),
    bySubject: v.array(
      v.object({
        subjectId: v.union(v.id("subjects"), v.null()),
        name: v.string(),
        minutes: v.number(),
      }),
    ),
    byEntryType: v.array(
      v.object({
        entryType: entryTypeValidator,
        label: v.string(),
        minutes: v.number(),
      }),
    ),
    verifiedBreakdown: v.array(
      v.object({
        status: v.union(v.literal("verified"), v.literal("unverified")),
        minutes: v.number(),
      }),
    ),
    totals: v.object({
      totalMinutes: v.number(),
      verifiedMinutes: v.number(),
      unverifiedMinutes: v.number(),
      entryCount: v.number(),
      daysLogged: v.number(),
      streak: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);

    const until = args.until ?? args.since;
    const since = Math.min(args.since, until);
    const end = Math.max(args.since, until);

    const logs = (
      await ctx.db
        .query("logs")
        .withIndex("by_student_and_createdAt", (q) =>
          q
            .eq("studentId", args.studentId)
            .gte("createdAt", since)
            .lte("createdAt", end),
        )
        .take(500)
    ).filter(isLogActive);

    const dateKeys = eachDateKey(since, end);
    const dayMap = new Map<
      string,
      { minutes: number; verifiedMinutes: number }
    >();
    for (const key of dateKeys) {
      dayMap.set(key, { minutes: 0, verifiedMinutes: 0 });
    }

    const subjectMinutes = new Map<
      string,
      { subjectId: Id<"subjects"> | null; name: string; minutes: number }
    >();
    const byEntryTypeMinutes = {
      native_completion: 0,
      external_time: 0,
      manual: 0,
    };
    const entryTypeLabels = {
      native_completion: "Native",
      external_time: "External",
      manual: "Manual",
    } as const;

    let totalMinutes = 0;
    let verifiedMinutes = 0;
    const daysWithActivity = new Set<string>();

    const subjectNameCache = new Map<Id<"subjects">, string>();
    const courseSubjectCache = new Map<Id<"courses">, Id<"subjects"> | null>();

    async function resolveSubjectName(
      subjectId: Id<"subjects"> | undefined,
      courseId: Id<"courses"> | undefined,
    ): Promise<{ subjectId: Id<"subjects"> | null; name: string }> {
      let resolvedId = subjectId;
      if (!resolvedId && courseId) {
        if (!courseSubjectCache.has(courseId)) {
          const course = await ctx.db.get("courses", courseId);
          courseSubjectCache.set(courseId, course?.subjectId ?? null);
        }
        resolvedId = courseSubjectCache.get(courseId) ?? undefined;
      }
      if (!resolvedId) {
        return { subjectId: null, name: "Uncategorized" };
      }
      if (!subjectNameCache.has(resolvedId)) {
        const subject = await ctx.db.get("subjects", resolvedId);
        subjectNameCache.set(resolvedId, subject?.name ?? "Uncategorized");
      }
      return {
        subjectId: resolvedId,
        name: subjectNameCache.get(resolvedId) ?? "Uncategorized",
      };
    }

    for (const log of logs) {
      const dateKey = toDateKey(log.createdAt);
      const bucket = dayMap.get(dateKey);
      if (bucket) {
        bucket.minutes += log.durationMinutes;
        if (log.verifiedByParent) {
          bucket.verifiedMinutes += log.durationMinutes;
        }
      }
      daysWithActivity.add(dateKey);

      totalMinutes += log.durationMinutes;
      if (log.verifiedByParent) {
        verifiedMinutes += log.durationMinutes;
      }
      byEntryTypeMinutes[log.entryType] += log.durationMinutes;

      const subject = await resolveSubjectName(log.subjectId, log.courseId);
      const mapKey = subject.subjectId ?? "uncategorized";
      const existing = subjectMinutes.get(mapKey);
      if (existing) {
        existing.minutes += log.durationMinutes;
      } else {
        subjectMinutes.set(mapKey, {
          subjectId: subject.subjectId,
          name: subject.name,
          minutes: log.durationMinutes,
        });
      }
    }

    const untilDateKey = toDateKey(end);

    return {
      timeSeries: dateKeys.map((date) => {
        const bucket = dayMap.get(date)!;
        return {
          date,
          minutes: bucket.minutes,
          verifiedMinutes: bucket.verifiedMinutes,
        };
      }),
      bySubject: [...subjectMinutes.values()].sort(
        (a, b) => b.minutes - a.minutes,
      ),
      byEntryType: (
        Object.keys(byEntryTypeMinutes) as Array<
          keyof typeof byEntryTypeMinutes
        >
      ).map((entryType) => ({
        entryType,
        label: entryTypeLabels[entryType],
        minutes: byEntryTypeMinutes[entryType],
      })),
      verifiedBreakdown: [
        { status: "verified" as const, minutes: verifiedMinutes },
        {
          status: "unverified" as const,
          minutes: totalMinutes - verifiedMinutes,
        },
      ],
      totals: {
        totalMinutes,
        verifiedMinutes,
        unverifiedMinutes: totalMinutes - verifiedMinutes,
        entryCount: logs.length,
        daysLogged: daysWithActivity.size,
        streak: streakEndingOn(daysWithActivity, untilDateKey),
      },
    };
  },
});
