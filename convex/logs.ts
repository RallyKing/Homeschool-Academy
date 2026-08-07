import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStudentFamilyAccess } from "./lib/auth";
import { entryTypeValidator, logDocValidator } from "./lib/validators";

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
      notes: args.notes,
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
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_student_and_createdAt", (q) =>
        q.eq("studentId", args.studentId),
      )
      .order("desc")
      .take(limit);

    return logs;
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
