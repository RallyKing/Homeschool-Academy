import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStudentFamilyAccess } from "./lib/auth";
import { scheduleDocValidator } from "./lib/validators";

export const listForStudent = query({
  args: { studentId: v.id("students") },
  returns: v.array(scheduleDocValidator),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    return await ctx.db
      .query("schedules")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .take(50);
  },
});

export const createDraft = mutation({
  args: {
    studentId: v.id("students"),
    weekStart: v.string(),
    weekEnd: v.string(),
  },
  returns: v.id("schedules"),
  handler: async (ctx, args) => {
    const { user } = await requireStudentFamilyAccess(ctx, args.studentId);

    return await ctx.db.insert("schedules", {
      studentId: args.studentId,
      weekStart: args.weekStart,
      weekEnd: args.weekEnd,
      status: "draft",
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const requestApproval = mutation({
  args: { scheduleId: v.id("schedules") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    await requireStudentFamilyAccess(ctx, schedule.studentId);

    if (schedule.status !== "draft") {
      throw new Error("Only draft schedules can request approval");
    }

    await ctx.db.patch("schedules", args.scheduleId, {
      status: "pending_approval",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const approve = mutation({
  args: { scheduleId: v.id("schedules") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);

    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can approve schedules");
    }

    if (schedule.status !== "pending_approval") {
      throw new Error("Schedule is not pending approval");
    }

    await ctx.db.patch("schedules", args.scheduleId, {
      status: "approved",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const addItem = mutation({
  args: {
    scheduleId: v.id("schedules"),
    title: v.string(),
    plannedMinutes: v.number(),
    courseId: v.optional(v.id("courses")),
    dayOfWeek: v.optional(v.number()),
    date: v.optional(v.string()),
  },
  returns: v.id("scheduleItems"),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    await requireStudentFamilyAccess(ctx, schedule.studentId);

    if (schedule.status === "approved") {
      throw new Error("Cannot modify an approved schedule");
    }

    return await ctx.db.insert("scheduleItems", {
      scheduleId: args.scheduleId,
      title: args.title,
      plannedMinutes: args.plannedMinutes,
      courseId: args.courseId,
      dayOfWeek: args.dayOfWeek,
      date: args.date,
      createdAt: Date.now(),
    });
  },
});

export const listItems = query({
  args: { scheduleId: v.id("schedules") },
  returns: v.array(
    v.object({
      _id: v.id("scheduleItems"),
      _creationTime: v.number(),
      scheduleId: v.id("schedules"),
      courseId: v.optional(v.id("courses")),
      title: v.string(),
      plannedMinutes: v.number(),
      dayOfWeek: v.optional(v.number()),
      date: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    await requireStudentFamilyAccess(ctx, schedule.studentId);

    return await ctx.db
      .query("scheduleItems")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", args.scheduleId))
      .collect();
  },
});
