import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireSuperAdmin } from "./lib/auth";
import { familyDocValidator, userDocValidator } from "./lib/validators";

const academyDocValidator = v.object({
  _id: v.id("academies"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  description: v.optional(v.string()),
  createdAt: v.number(),
});

export const listUsers = query({
  args: {},
  returns: v.array(userDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("users").take(200);
  },
});

export const listFamilies = query({
  args: {},
  returns: v.array(familyDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("families").take(200);
  },
});

export const listAcademies = query({
  args: {},
  returns: v.array(academyDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("academies").take(200);
  },
});

export const overview = query({
  args: {},
  returns: v.object({
    userCount: v.number(),
    familyCount: v.number(),
    academyCount: v.number(),
    studentCount: v.number(),
    courseCount: v.number(),
    logCount: v.number(),
    subjectCount: v.number(),
    usersByRole: v.object({
      superAdmin: v.number(),
      parent: v.number(),
      teacher: v.number(),
      student: v.number(),
      unset: v.number(),
    }),
  }),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const users = await ctx.db.query("users").take(500);
    const families = await ctx.db.query("families").take(500);
    const academies = await ctx.db.query("academies").take(500);
    const students = await ctx.db.query("students").take(500);
    const courses = await ctx.db.query("courses").take(500);
    const logs = await ctx.db.query("logs").take(500);
    const subjects = await ctx.db.query("subjects").take(100);

    const usersByRole = {
      superAdmin: 0,
      parent: 0,
      teacher: 0,
      student: 0,
      unset: 0,
    };

    for (const u of users) {
      if (u.role === "superAdmin") usersByRole.superAdmin += 1;
      else if (u.role === "parent") usersByRole.parent += 1;
      else if (u.role === "teacher") usersByRole.teacher += 1;
      else if (u.role === "student") usersByRole.student += 1;
      else usersByRole.unset += 1;
    }

    return {
      userCount: users.length,
      familyCount: families.length,
      academyCount: academies.length,
      studentCount: students.length,
      courseCount: courses.length,
      logCount: logs.length,
      subjectCount: subjects.length,
      usersByRole,
    };
  },
});

export const promoteToSuperAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new Error("User not found");
    }
    await ctx.db.patch("users", args.userId, { role: "superAdmin" });
    return null;
  },
});

export const bootstrapSuperAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingAdmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
      .take(1);

    if (existingAdmins.length > 0) {
      throw new Error("A superAdmin already exists");
    }

    const user = await getCurrentUser(ctx);
    await ctx.db.patch("users", user._id, { role: "superAdmin" });
    return null;
  },
});
