import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireAcademyAccess,
  requireFamilyAccess,
  requireFamilyReadAccess,
  requireRole,
} from "./lib/auth";
import { courseDocValidator } from "./lib/validators";

const moduleDocValidator = v.object({
  _id: v.id("modules"),
  _creationTime: v.number(),
  courseId: v.id("courses"),
  title: v.string(),
  order: v.number(),
  createdAt: v.number(),
});

const lessonDocValidator = v.object({
  _id: v.id("lessons"),
  _creationTime: v.number(),
  moduleId: v.id("modules"),
  title: v.string(),
  order: v.number(),
  estimatedMinutes: v.optional(v.number()),
  createdAt: v.number(),
});

export const listForFamily = query({
  args: { familyId: v.optional(v.id("families")) },
  returns: v.array(courseDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    let familyId = args.familyId;
    if (!familyId) {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (!family) return [];
      familyId = family._id;
    }
    await requireFamilyAccess(ctx, familyId);
    return await ctx.db
      .query("courses")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
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

export const listAvailableForMyFamily = query({
  args: {},
  returns: v.array(courseDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    let family = await getPrimaryFamilyForUser(ctx, user._id);

    if (!family) {
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (linked) {
        family = await ctx.db.get("families", linked.familyId);
      }
    }

    if (!family) {
      return [];
    }

    const own = await ctx.db
      .query("courses")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    const subs = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    const academyCourses: typeof own = [];
    for (const sub of subs) {
      if (sub.status !== "active") continue;
      const courseList = await ctx.db
        .query("courses")
        .withIndex("by_academy", (q) => q.eq("academyId", sub.academyId))
        .collect();
      academyCourses.push(...courseList);
    }

    const seen = new Set<string>();
    const combined = [];
    for (const course of [...own, ...academyCourses]) {
      if (seen.has(course._id)) continue;
      seen.add(course._id);
      combined.push(course);
    }
    return combined;
  },
});

export const getStructure = query({
  args: { courseId: v.id("courses") },
  returns: v.union(
    v.object({
      course: courseDocValidator,
      modules: v.array(
        v.object({
          module: moduleDocValidator,
          lessons: v.array(lessonDocValidator),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course) return null;

    if (course.familyId) {
      await requireFamilyReadAccess(ctx, course.familyId);
    } else if (course.academyId) {
      // Subscribed families or academy members can view
      const user = await getCurrentUser(ctx);
      try {
        await requireAcademyAccess(ctx, course.academyId);
      } catch {
        let family = await getPrimaryFamilyForUser(ctx, user._id);
        if (!family) {
          const linked = await ctx.db
            .query("students")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();
          if (linked) {
            family = await ctx.db.get("families", linked.familyId);
          }
        }
        if (!family) throw new Error("Unauthorized");
        const sub = await ctx.db
          .query("familyAcademySubscriptions")
          .withIndex("by_family_and_academy", (q) =>
            q.eq("familyId", family._id).eq("academyId", course.academyId!),
          )
          .unique();
        if (!sub || sub.status !== "active") {
          if (user.role !== "superAdmin") {
            throw new Error("Unauthorized: subscribe to view this course");
          }
        }
      }
    }

    const modules = await ctx.db
      .query("modules")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    modules.sort((a, b) => a.order - b.order);

    const result = [];
    for (const mod of modules) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_module", (q) => q.eq("moduleId", mod._id))
        .collect();
      lessons.sort((a, b) => a.order - b.order);
      result.push({ module: mod, lessons });
    }

    return { course, modules: result };
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

    const title = args.title.trim();
    if (!title) throw new Error("Course title is required");

    let familyId = args.familyId;
    let academyId = args.academyId;

    if (args.ownerType === "family") {
      if (!familyId) {
        const user = await getCurrentUser(ctx);
        const family = await getPrimaryFamilyForUser(ctx, user._id);
        if (!family) throw new Error("Create a family first");
        familyId = family._id;
      }
      await requireFamilyAccess(ctx, familyId);
    }

    if (args.ownerType === "academy") {
      if (!academyId) {
        throw new Error("academyId required for academy-owned courses");
      }
      await requireAcademyAccess(ctx, academyId);
    }

    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) {
      throw new Error("Subject not found");
    }

    if (args.type === "external" && !args.externalSourceName?.trim()) {
      throw new Error("External courses need a source name (e.g. Zearn)");
    }

    return await ctx.db.insert("courses", {
      type: args.type,
      title,
      description: args.description?.trim() || undefined,
      subjectId: args.subjectId,
      ownerType: args.ownerType,
      familyId: args.ownerType === "family" ? familyId : undefined,
      academyId: args.ownerType === "academy" ? academyId : undefined,
      externalSourceName: args.externalSourceName?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const addModule = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    order: v.optional(v.number()),
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

    if (course.familyId) {
      await requireFamilyAccess(ctx, course.familyId);
    } else if (course.academyId) {
      await requireAcademyAccess(ctx, course.academyId);
    }

    let order = args.order;
    if (order === undefined) {
      const existing = await ctx.db
        .query("modules")
        .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
        .collect();
      order = existing.length;
    }

    return await ctx.db.insert("modules", {
      courseId: args.courseId,
      title: args.title.trim(),
      order,
      createdAt: Date.now(),
    });
  },
});

export const addLesson = mutation({
  args: {
    moduleId: v.id("modules"),
    title: v.string(),
    order: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
  },
  returns: v.id("lessons"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "teacher", "superAdmin"]);
    const mod = await ctx.db.get("modules", args.moduleId);
    if (!mod) {
      throw new Error("Module not found");
    }

    const course = await ctx.db.get("courses", mod.courseId);
    if (!course) throw new Error("Course not found");
    if (course.familyId) {
      await requireFamilyAccess(ctx, course.familyId);
    } else if (course.academyId) {
      await requireAcademyAccess(ctx, course.academyId);
    }

    let order = args.order;
    if (order === undefined) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId))
        .collect();
      order = existing.length;
    }

    return await ctx.db.insert("lessons", {
      moduleId: args.moduleId,
      title: args.title.trim(),
      order,
      estimatedMinutes: args.estimatedMinutes,
      createdAt: Date.now(),
    });
  },
});
