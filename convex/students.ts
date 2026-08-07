import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireRole,
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

    return await ctx.db.insert("students", {
      familyId,
      displayName: args.displayName,
      birthYear: args.birthYear,
      academicLevel: args.academicLevel,
      createdAt: Date.now(),
    });
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
    await requireFamilyAccess(ctx, student.familyId);
    return student;
  },
});
