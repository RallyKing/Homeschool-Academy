import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireFamilyAccess, requireRole } from "./lib/auth";
import { courseDocValidator } from "./lib/validators";

export const listForFamily = query({
  args: { familyId: v.id("families") },
  returns: v.array(courseDocValidator),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    return await ctx.db
      .query("courses")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();
  },
});

export const listForAcademy = query({
  args: { academyId: v.id("academies") },
  returns: v.array(courseDocValidator),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_academy", (q) => q.eq("academyId", args.academyId))
      .collect();
  },
});

export const create = mutation({
  args: {
    type: v.union(v.literal("native"), v.literal("external")),
    title: v.string(),
    description: v.optional(v.string()),
    subjectId: v.id("subjects"),
    ownerType: v.union(v.literal("family"), v.literal("academy")),
    familyId: v.optional(v.id("families")),
    academyId: v.optional(v.id("academies")),
    externalSourceName: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "teacher", "superAdmin"]);

    if (args.ownerType === "family") {
      if (!args.familyId) {
        throw new Error("familyId required for family-owned courses");
      }
      await requireFamilyAccess(ctx, args.familyId);
    }

    if (args.ownerType === "academy" && !args.academyId) {
      throw new Error("academyId required for academy-owned courses");
    }

    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) {
      throw new Error("Subject not found");
    }

    return await ctx.db.insert("courses", {
      type: args.type,
      title: args.title,
      description: args.description,
      subjectId: args.subjectId,
      ownerType: args.ownerType,
      familyId: args.familyId,
      academyId: args.academyId,
      externalSourceName: args.externalSourceName,
      createdAt: Date.now(),
    });
  },
});

export const addModule = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    order: v.number(),
  },
  returns: v.id("modules"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "teacher", "superAdmin"]);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    if (course.type !== "native") {
      throw new Error("Modules only apply to native courses");
    }

    return await ctx.db.insert("modules", {
      courseId: args.courseId,
      title: args.title,
      order: args.order,
      createdAt: Date.now(),
    });
  },
});

export const addLesson = mutation({
  args: {
    moduleId: v.id("modules"),
    title: v.string(),
    order: v.number(),
    estimatedMinutes: v.optional(v.number()),
  },
  returns: v.id("lessons"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "teacher", "superAdmin"]);
    const mod = await ctx.db.get("modules", args.moduleId);
    if (!mod) {
      throw new Error("Module not found");
    }

    return await ctx.db.insert("lessons", {
      moduleId: args.moduleId,
      title: args.title,
      order: args.order,
      estimatedMinutes: args.estimatedMinutes,
      createdAt: Date.now(),
    });
  },
});
