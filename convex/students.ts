import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  deleteStudentData,
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireRole,
  requireStudentFamilyAccess,
} from "./lib/auth";
import { studentDocValidator } from "./lib/validators";

export const listForMyFamily = query({
  args: {},
  returns: v.array(studentDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const family = await getPrimaryFamilyForUser(ctx, user._id);
    if (!family) {
      return [];
    }

    return await ctx.db
      .query("students")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();
  },
});

export const listForFamily = query({
  args: { familyId: v.id("families") },
  returns: v.array(studentDocValidator),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    return await ctx.db
      .query("students")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();
  },
});

export const create = mutation({
  args: {
    familyId: v.optional(v.id("families")),
    displayName: v.string(),
    birthYear: v.optional(v.number()),
    academicLevel: v.optional(v.string()),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);

    let familyId = args.familyId;
    if (!familyId) {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (!family) {
        throw new Error("No family found. Create a family first.");
      }
      familyId = family._id;
    }

    await requireFamilyAccess(ctx, familyId);

    const displayName = args.displayName.trim();
    if (!displayName) {
      throw new Error("Student name is required");
    }

    return await ctx.db.insert("students", {
      familyId,
      displayName,
      birthYear: args.birthYear,
      academicLevel: args.academicLevel?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    studentId: v.id("students"),
    displayName: v.optional(v.string()),
    birthYear: v.optional(v.number()),
    academicLevel: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );

    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can edit student profiles");
    }

    const patch: {
      displayName?: string;
      birthYear?: number;
      academicLevel?: string;
    } = {};

    if (args.displayName !== undefined) {
      const name = args.displayName.trim();
      if (!name) throw new Error("Student name is required");
      patch.displayName = name;
    }
    if (args.birthYear !== undefined) {
      patch.birthYear = args.birthYear;
    }
    if (args.academicLevel !== undefined) {
      patch.academicLevel = args.academicLevel.trim() || undefined;
    }

    await ctx.db.patch("students", student._id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can delete students");
    }
    await deleteStudentData(ctx, student._id);
    return null;
  },
});

export const linkToCurrentUser = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const student = await ctx.db.get("students", args.studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    // Parent can link a family student to a user, or student can claim themselves
    if (user.role === "parent" || user.role === "superAdmin") {
      await requireFamilyAccess(ctx, student.familyId);
    } else if (user.role === "student") {
      await requireFamilyAccess(ctx, student.familyId);
      if (student.userId && student.userId !== user._id) {
        throw new Error("Student profile already linked to another account");
      }
    } else {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch("students", args.studentId, { userId: user._id });
    return null;
  },
});

export const linkByEmail = mutation({
  args: {
    studentId: v.id("students"),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, student } = await requireStudentFamilyAccess(
      ctx,
      args.studentId,
    );
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can link student accounts");
    }

    const email = args.email.trim().toLowerCase();
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (!target) {
      throw new Error("No user found with that email. Have them sign up first.");
    }

    await ctx.db.patch("students", student._id, { userId: target._id });
    if (!target.role) {
      await ctx.db.patch("users", target._id, { role: "student" });
    }
    return null;
  },
});

export const claimByName = mutation({
  args: {
    familyName: v.string(),
    displayName: v.string(),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["student", "superAdmin"]);

    const familyName = args.familyName.trim();
    const families = await ctx.db
      .query("families")
      .withIndex("by_name", (q) => q.eq("name", familyName))
      .collect();

    if (families.length === 0) {
      throw new Error("No family found with that exact name");
    }

    const name = args.displayName.trim();
    for (const family of families) {
      const students = await ctx.db
        .query("students")
        .withIndex("by_family", (q) => q.eq("familyId", family._id))
        .collect();
      const match = students.find(
        (s) => s.displayName.toLowerCase() === name.toLowerCase(),
      );
      if (match) {
        if (match.userId && match.userId !== user._id) {
          throw new Error("That student profile is already linked");
        }
        await ctx.db.patch("students", match._id, { userId: user._id });
        return match._id;
      }
    }

    throw new Error("No matching student profile in that family");
  },
});

export const get = query({
  args: { studentId: v.id("students") },
  returns: v.union(studentDocValidator, v.null()),
  handler: async (ctx, args) => {
    const student = await ctx.db.get("students", args.studentId);
    if (!student) {
      return null;
    }
    await requireStudentFamilyAccess(ctx, args.studentId);
    return student;
  },
});

export const myProfile = query({
  args: {},
  returns: v.union(studentDocValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

/** Parent view-as: returns student profile only if caller is a parent of that family. */
export const getViewAsContext = query({
  args: { studentId: v.id("students") },
  returns: v.union(
    v.object({
      student: studentDocValidator,
      viewingAs: v.literal(true),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const student = await ctx.db.get("students", args.studentId);
    if (!student) {
      return null;
    }

    if (user.role === "superAdmin") {
      return { student, viewingAs: true as const };
    }

    const role = user.role ?? "parent";
    if (role !== "parent") {
      return null;
    }

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", student.familyId).eq("userId", user._id),
      )
      .unique();

    if (!membership) {
      return null;
    }

    return { student, viewingAs: true as const };
  },
});
