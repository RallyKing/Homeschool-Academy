import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { alertFamily, alertStudent } from "./lib/alerts";
import {
  requireFamilyAccess,
  requireStudentFamilyAccess,
} from "./lib/auth";
import {
  awardProgress,
  rewardsForChore,
} from "./lib/gamificationCore";

const recurrenceValidator = v.union(
  v.literal("once"),
  v.literal("daily"),
  v.literal("weekly"),
);

const statusValidator = v.union(
  v.literal("todo"),
  v.literal("done"),
  v.literal("skipped"),
);

const choreDocValidator = v.object({
  _id: v.id("chores"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  studentId: v.id("students"),
  title: v.string(),
  description: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  recurrence: recurrenceValidator,
  status: statusValidator,
  xpReward: v.optional(v.number()),
  pointsReward: v.optional(v.number()),
  starsReward: v.optional(v.number()),
  assignedBy: v.id("users"),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const listForFamily = query({
  args: {
    familyId: v.id("families"),
    status: v.optional(statusValidator),
    studentId: v.optional(v.id("students")),
  },
  returns: v.array(
    v.object({
      chore: choreDocValidator,
      studentName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);

    let chores;
    if (args.studentId && args.status) {
      const all = await ctx.db
        .query("chores")
        .withIndex("by_student_and_status", (q) =>
          q.eq("studentId", args.studentId!).eq("status", args.status!),
        )
        .collect();
      chores = all.filter((c) => c.familyId === args.familyId);
    } else if (args.studentId) {
      chores = await ctx.db
        .query("chores")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else if (args.status) {
      chores = await ctx.db
        .query("chores")
        .withIndex("by_family_and_status", (q) =>
          q.eq("familyId", args.familyId).eq("status", args.status!),
        )
        .collect();
    } else {
      chores = await ctx.db
        .query("chores")
        .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
        .collect();
    }

    const out = [];
    for (const chore of chores) {
      const student = await ctx.db.get("students", chore.studentId);
      out.push({
        chore,
        studentName: student?.displayName ?? "Student",
      });
    }
    return out.sort((a, b) => b.chore.createdAt - a.chore.createdAt);
  },
});

export const listMine = query({
  args: {
    studentId: v.id("students"),
    status: v.optional(statusValidator),
  },
  returns: v.array(choreDocValidator),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    if (args.status) {
      return await ctx.db
        .query("chores")
        .withIndex("by_student_and_status", (q) =>
          q.eq("studentId", args.studentId).eq("status", args.status!),
        )
        .collect();
    }
    return await ctx.db
      .query("chores")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
  },
});

export const get = query({
  args: { choreId: v.id("chores") },
  returns: v.union(choreDocValidator, v.null()),
  handler: async (ctx, args) => {
    const chore = await ctx.db.get("chores", args.choreId);
    if (!chore) return null;
    await requireStudentFamilyAccess(ctx, chore.studentId);
    return chore;
  },
});

export const create = mutation({
  args: {
    familyId: v.id("families"),
    studentId: v.id("students"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    recurrence: v.optional(recurrenceValidator),
    xpReward: v.optional(v.number()),
    pointsReward: v.optional(v.number()),
    starsReward: v.optional(v.number()),
  },
  returns: v.id("chores"),
  handler: async (ctx, args) => {
    const { user } = await requireFamilyAccess(ctx, args.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can assign chores");
    }

    const student = await ctx.db.get("students", args.studentId);
    if (!student || student.familyId !== args.familyId) {
      throw new Error("Student not found in this family");
    }

    const title = args.title.trim();
    if (!title) throw new Error("Chore title is required");

    const choreId = await ctx.db.insert("chores", {
      familyId: args.familyId,
      studentId: args.studentId,
      title,
      description: args.description?.trim() || undefined,
      dueDate: args.dueDate,
      recurrence: args.recurrence ?? "once",
      status: "todo",
      xpReward: args.xpReward,
      pointsReward: args.pointsReward,
      starsReward: args.starsReward,
      assignedBy: user._id,
      createdAt: Date.now(),
    });

    await alertStudent(ctx, {
      studentId: args.studentId,
      type: "chore_assigned",
      title: "New chore assigned",
      body: `“${title}” was added to your chore list.`,
      href: "/student/chores",
      createdBy: user._id,
      sourceTable: "chores",
      sourceId: choreId,
    });

    return choreId;
  },
});

export const update = mutation({
  args: {
    choreId: v.id("chores"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    recurrence: v.optional(recurrenceValidator),
    studentId: v.optional(v.id("students")),
    xpReward: v.optional(v.number()),
    pointsReward: v.optional(v.number()),
    starsReward: v.optional(v.number()),
    status: v.optional(statusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chore = await ctx.db.get("chores", args.choreId);
    if (!chore) throw new Error("Chore not found");

    const { user } = await requireFamilyAccess(ctx, chore.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can update chores");
    }

    const patch: {
      title?: string;
      description?: string;
      dueDate?: string;
      recurrence?: "once" | "daily" | "weekly";
      studentId?: typeof args.studentId;
      xpReward?: number;
      pointsReward?: number;
      starsReward?: number;
      status?: "todo" | "done" | "skipped";
      updatedAt: number;
      completedAt?: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.recurrence !== undefined) patch.recurrence = args.recurrence;
    if (args.xpReward !== undefined) patch.xpReward = args.xpReward;
    if (args.pointsReward !== undefined) patch.pointsReward = args.pointsReward;
    if (args.starsReward !== undefined) patch.starsReward = args.starsReward;
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "done") patch.completedAt = Date.now();
    }

    if (args.studentId !== undefined) {
      const student = await ctx.db.get("students", args.studentId);
      if (!student || student.familyId !== chore.familyId) {
        throw new Error("Student not found in this family");
      }
      patch.studentId = args.studentId;
      if (args.studentId !== chore.studentId) {
        await alertStudent(ctx, {
          studentId: args.studentId,
          type: "chore_assigned",
          title: "Chore reassigned to you",
          body: `“${chore.title}” is now on your list.`,
          href: "/student/chores",
          createdBy: user._id,
          sourceTable: "chores",
          sourceId: args.choreId,
        });
      }
    }

    await ctx.db.patch("chores", args.choreId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { choreId: v.id("chores") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chore = await ctx.db.get("chores", args.choreId);
    if (!chore) throw new Error("Chore not found");
    const { user } = await requireFamilyAccess(ctx, chore.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can delete chores");
    }
    await ctx.db.delete("chores", args.choreId);
    return null;
  },
});

export const markDone = mutation({
  args: {
    choreId: v.id("chores"),
    today: v.string(),
    weekStart: v.optional(v.string()),
  },
  returns: v.object({
    xpGained: v.number(),
    pointsGained: v.number(),
    starsGained: v.number(),
    leveledUp: v.boolean(),
    newLevel: v.number(),
  }),
  handler: async (ctx, args) => {
    const chore = await ctx.db.get("chores", args.choreId);
    if (!chore) throw new Error("Chore not found");
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      chore.studentId,
    );

    if (chore.status === "done") {
      throw new Error("Chore already completed");
    }
    if (chore.status === "skipped") {
      throw new Error("Chore was skipped");
    }

    await ctx.db.patch("chores", args.choreId, {
      status: "done",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    const rewards = rewardsForChore(chore);
    const result = await awardProgress(ctx, {
      studentId: chore.studentId,
      familyId: chore.familyId,
      today: args.today,
      weekStart: args.weekStart,
      xp: rewards.xp,
      points: rewards.points,
      stars: rewards.stars,
      source: "chore",
      sourceId: args.choreId,
      choreIncrement: 1,
    });

    // Recurring: spawn next instance
    if (chore.recurrence === "daily" || chore.recurrence === "weekly") {
      let nextDue: string | undefined;
      if (chore.dueDate) {
        const [y, m, d] = chore.dueDate.split("-").map(Number);
        const dt = new Date(Date.UTC(y!, m! - 1, d!));
        dt.setUTCDate(
          dt.getUTCDate() + (chore.recurrence === "daily" ? 1 : 7),
        );
        nextDue = dt.toISOString().slice(0, 10);
      }
      await ctx.db.insert("chores", {
        familyId: chore.familyId,
        studentId: chore.studentId,
        title: chore.title,
        description: chore.description,
        dueDate: nextDue,
        recurrence: chore.recurrence,
        status: "todo",
        xpReward: chore.xpReward,
        pointsReward: chore.pointsReward,
        starsReward: chore.starsReward,
        assignedBy: chore.assignedBy,
        createdAt: Date.now(),
      });
    }

    await alertFamily(ctx, {
      familyId: chore.familyId,
      studentId: chore.studentId,
      type: "chore_completed",
      title: "Chore completed",
      body: `${student.displayName} finished “${chore.title}” (+${result.xpGained} XP, +${result.pointsGained} pts).`,
      href: "/family/chores",
      createdBy: user._id,
      sourceTable: "chores",
      sourceId: args.choreId,
    });

    return {
      xpGained: result.xpGained,
      pointsGained: result.pointsGained,
      starsGained: result.starsGained,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
    };
  },
});

export const skip = mutation({
  args: { choreId: v.id("chores") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chore = await ctx.db.get("chores", args.choreId);
    if (!chore) throw new Error("Chore not found");
    const { user } = await requireStudentFamilyAccess(ctx, chore.studentId);
    const isParent =
      user.role === "parent" || user.role === "superAdmin";
    const isStudentOwner = chore.studentId
      ? (await ctx.db.get("students", chore.studentId))?.userId === user._id
      : false;
    if (!isParent && !isStudentOwner) {
      throw new Error("Unauthorized to skip this chore");
    }
    await ctx.db.patch("chores", args.choreId, {
      status: "skipped",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const reopen = mutation({
  args: { choreId: v.id("chores") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chore = await ctx.db.get("chores", args.choreId);
    if (!chore) throw new Error("Chore not found");
    const { user } = await requireFamilyAccess(ctx, chore.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can reopen chores");
    }
    await ctx.db.patch("chores", args.choreId, {
      status: "todo",
      completedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});
