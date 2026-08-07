import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireRole,
} from "./lib/auth";
import { familyDocValidator } from "./lib/validators";

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("families"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);
    const now = Date.now();

    const familyId = await ctx.db.insert("families", {
      name: args.name,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.insert("familyMembers", {
      familyId,
      userId: user._id,
      role: "parent",
      createdAt: now,
    });

    if (!user.role) {
      await ctx.db.patch("users", user._id, { role: "parent" });
    }

    return familyId;
  },
});

export const get = query({
  args: { familyId: v.id("families") },
  returns: v.union(familyDocValidator, v.null()),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    return await ctx.db.get("families", args.familyId);
  },
});

export const myFamilies = query({
  args: {},
  returns: v.array(familyDocValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const memberships = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const families = [];
    for (const m of memberships) {
      const family = await ctx.db.get("families", m.familyId);
      if (family) {
        families.push(family);
      }
    }
    return families;
  },
});

export const addMember = mutation({
  args: {
    familyId: v.id("families"),
    userId: v.id("users"),
    role: v.union(v.literal("parent"), v.literal("guardian")),
  },
  returns: v.id("familyMembers"),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);

    const existing = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", args.userId),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("familyMembers", {
      familyId: args.familyId,
      userId: args.userId,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

export const ensureMine = mutation({
  args: { name: v.optional(v.string()) },
  returns: v.id("families"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);
    const existing = await getPrimaryFamilyForUser(ctx, user._id);
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const familyId = await ctx.db.insert("families", {
      name: args.name ?? `${user.name ?? "Family"} Household`,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.insert("familyMembers", {
      familyId,
      userId: user._id,
      role: "parent",
      createdAt: now,
    });

    return familyId;
  },
});
