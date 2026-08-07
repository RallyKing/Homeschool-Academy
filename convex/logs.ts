import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireStudentFamilyAccess } from "./lib/auth";
import { entryTypeValidator, logDocValidator } from "./lib/validators";

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
  },
  returns: v.id("logs"),
  handler: async (ctx, args) => {
    const { user } = await requireStudentFamilyAccess(ctx, args.studentId);

    if (args.durationMinutes <= 0) {
      throw new Error("Duration must be greater than 0");
    }

    if (args.courseId) {
      const course = await ctx.db.get("courses", args.courseId);
      if (!course) {
        throw new Error("Course not found");
      }
    }

    if (args.subjectId) {
      const subject = await ctx.db.get("subjects", args.subjectId);
      if (!subject) {
        throw new Error("Subject not found");
      }
    }

    return await ctx.db.insert("logs", {
      studentId: args.studentId,
      courseId: args.courseId,
      subjectId: args.subjectId,
      entryType: args.entryType,
      durationMinutes: args.durationMinutes,
      notes: args.notes?.trim() || undefined,
      storageId: args.storageId,
      verifiedByParent: false,
      createdBy: user._id,
      createdAt: Date.now(),
    });
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

    const filtered = args.since
      ? logs.filter((l) => l.createdAt >= args.since!)
      : logs;

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
