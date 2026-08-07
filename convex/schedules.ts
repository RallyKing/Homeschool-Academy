import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { alertStudent, alertFamily } from "./lib/alerts";
import {
  deleteScheduleItems,
  requireStudentFamilyAccess,
} from "./lib/auth";
import { scheduleDocValidator } from "./lib/validators";

const scheduleItemDocValidator = v.object({
  _id: v.id("scheduleItems"),
  _creationTime: v.number(),
  scheduleId: v.id("schedules"),
  courseId: v.optional(v.id("courses")),
  title: v.string(),
  plannedMinutes: v.number(),
  dayOfWeek: v.optional(v.number()),
  date: v.optional(v.string()),
  createdAt: v.number(),
});

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

export const getApprovedForWeek = query({
  args: {
    studentId: v.id("students"),
    weekStart: v.string(),
  },
  returns: v.union(
    v.object({
      schedule: scheduleDocValidator,
      items: v.array(scheduleItemDocValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);

    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_student_and_status", (q) =>
        q.eq("studentId", args.studentId).eq("status", "approved"),
      )
      .collect();

    const schedule =
      schedules.find((s) => s.weekStart === args.weekStart) ?? null;
    if (!schedule) return null;

    const items = await ctx.db
      .query("scheduleItems")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", schedule._id))
      .collect();

    return { schedule, items };
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

    if (user.role === "student") {
      throw new Error("Students cannot create schedules; ask a parent");
    }

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

export const update = mutation({
  args: {
    scheduleId: v.id("schedules"),
    weekStart: v.optional(v.string()),
    weekEnd: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);
    if (user.role === "student") {
      throw new Error("Students cannot edit schedules");
    }
    if (schedule.status === "approved") {
      throw new Error("Cannot edit an approved schedule — request revision first");
    }

    const patch: {
      weekStart?: string;
      weekEnd?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.weekStart !== undefined) {
      patch.weekStart = args.weekStart;
    }
    if (args.weekEnd !== undefined) {
      patch.weekEnd = args.weekEnd;
    }
    await ctx.db.patch("schedules", args.scheduleId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { scheduleId: v.id("schedules") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);
    if (user.role === "student") {
      throw new Error("Students cannot delete schedules");
    }
    await deleteScheduleItems(ctx, schedule._id);
    await ctx.db.delete("schedules", schedule._id);
    return null;
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
    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);

    if (user.role === "student") {
      throw new Error("Only parents can submit schedules for approval");
    }

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

    const student = await ctx.db.get("students", schedule.studentId);
    if (student) {
      await alertStudent(ctx, {
        studentId: student._id,
        type: "schedule_approved",
        title: "Schedule approved",
        body: `Your schedule for the week of ${schedule.weekStart} was approved.`,
        href: "/student/dashboard",
        createdBy: user._id,
        sourceTable: "schedules",
        sourceId: args.scheduleId,
      });
    }

    return null;
  },
});

export const requestRevision = mutation({
  args: {
    scheduleId: v.id("schedules"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get("schedules", args.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      schedule.studentId,
    );

    if (schedule.status !== "approved" && schedule.status !== "pending_approval") {
      throw new Error("Only approved or pending schedules can request revision");
    }

    await ctx.db.patch("schedules", args.scheduleId, {
      status: "draft",
      updatedAt: Date.now(),
    });

    const noteSuffix = args.note?.trim()
      ? ` Note: ${args.note.trim()}`
      : "";
    await alertFamily(ctx, {
      familyId: student.familyId,
      studentId: student._id,
      type: "schedule_revision_requested",
      title: "Schedule revision requested",
      body: `${student.displayName} requested a schedule revision for the week of ${schedule.weekStart}.${noteSuffix}`,
      href: "/family/planner",
      createdBy: user._id,
      sourceTable: "schedules",
      sourceId: args.scheduleId,
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
    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);

    if (user.role === "student") {
      throw new Error("Students cannot edit schedule items");
    }

    if (schedule.status === "approved") {
      throw new Error("Cannot modify an approved schedule — request revision first");
    }

    const title = args.title.trim();
    if (!title) throw new Error("Item title is required");
    if (args.plannedMinutes <= 0) {
      throw new Error("Planned minutes must be greater than 0");
    }

    const itemId = await ctx.db.insert("scheduleItems", {
      scheduleId: args.scheduleId,
      title,
      plannedMinutes: args.plannedMinutes,
      courseId: args.courseId,
      dayOfWeek: args.dayOfWeek,
      date: args.date,
      createdAt: Date.now(),
    });

    await alertStudent(ctx, {
      studentId: schedule.studentId,
      type: "schedule_item_added",
      title: "New schedule item",
      body: `“${title}” (${args.plannedMinutes} min) was added to your plan for the week of ${schedule.weekStart}.`,
      href: "/student/dashboard",
      createdBy: user._id,
      sourceTable: "scheduleItems",
      sourceId: itemId,
    });

    return itemId;
  },
});

export const removeItem = mutation({
  args: { itemId: v.id("scheduleItems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("scheduleItems", args.itemId);
    if (!item) throw new Error("Item not found");

    const schedule = await ctx.db.get("schedules", item.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);
    if (user.role === "student") {
      throw new Error("Students cannot edit schedule items");
    }
    if (schedule.status === "approved") {
      throw new Error("Cannot modify an approved schedule");
    }

    await ctx.db.delete("scheduleItems", args.itemId);
    return null;
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("scheduleItems"),
    title: v.optional(v.string()),
    plannedMinutes: v.optional(v.number()),
    courseId: v.optional(v.id("courses")),
    dayOfWeek: v.optional(v.number()),
    date: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("scheduleItems", args.itemId);
    if (!item) throw new Error("Item not found");

    const schedule = await ctx.db.get("schedules", item.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const { user } = await requireStudentFamilyAccess(ctx, schedule.studentId);
    if (user.role === "student") {
      throw new Error("Students cannot edit schedule items");
    }
    if (schedule.status === "approved") {
      throw new Error("Cannot modify an approved schedule");
    }

    const patch: {
      title?: string;
      plannedMinutes?: number;
      courseId?: typeof args.courseId;
      dayOfWeek?: number;
      date?: string;
    } = {};

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Item title is required");
      patch.title = title;
    }
    if (args.plannedMinutes !== undefined) {
      if (args.plannedMinutes <= 0) {
        throw new Error("Planned minutes must be greater than 0");
      }
      patch.plannedMinutes = args.plannedMinutes;
    }
    if (args.courseId !== undefined) {
      patch.courseId = args.courseId;
    }
    if (args.dayOfWeek !== undefined) {
      patch.dayOfWeek = args.dayOfWeek;
    }
    if (args.date !== undefined) {
      patch.date = args.date;
    }

    await ctx.db.patch("scheduleItems", args.itemId, patch);
    return null;
  },
});

export const listItems = query({
  args: { scheduleId: v.id("schedules") },
  returns: v.array(scheduleItemDocValidator),
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
