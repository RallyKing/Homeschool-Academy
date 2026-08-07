import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireRole } from "./lib/auth";

const academyDocValidator = v.object({
  _id: v.id("academies"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  description: v.optional(v.string()),
  createdAt: v.number(),
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("academies"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["teacher", "superAdmin"]);
    const now = Date.now();

    const academyId = await ctx.db.insert("academies", {
      name: args.name,
      description: args.description,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.insert("academyMembers", {
      academyId,
      userId: user._id,
      role: "admin",
      createdAt: now,
    });

    if (!user.role) {
      await ctx.db.patch("users", user._id, { role: "teacher" });
    }

    return academyId;
  },
});

export const myAcademies = query({
  args: {},
  returns: v.array(academyDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const memberships = await ctx.db
      .query("academyMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const academies = [];
    for (const m of memberships) {
      const academy = await ctx.db.get("academies", m.academyId);
      if (academy) {
        academies.push(academy);
      }
    }
    return academies;
  },
});

export const listAll = query({
  args: {},
  returns: v.array(academyDocValidator),
  handler: async (ctx) => {
    await requireRole(ctx, ["superAdmin"]);
    return await ctx.db.query("academies").take(100);
  },
});

export const subscribeFamily = mutation({
  args: {
    familyId: v.id("families"),
    academyId: v.id("academies"),
  },
  returns: v.id("familyAcademySubscriptions"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["parent", "superAdmin"]);

    const existing = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_family_and_academy", (q) =>
        q.eq("familyId", args.familyId).eq("academyId", args.academyId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch("familyAcademySubscriptions", existing._id, {
        status: "active",
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("familyAcademySubscriptions", {
      familyId: args.familyId,
      academyId: args.academyId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});
