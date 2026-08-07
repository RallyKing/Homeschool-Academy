import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  deleteFamilyCascade,
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireRole,
} from "./lib/auth";
import { familyDocValidator } from "./lib/validators";

const familyMemberDocValidator = v.object({
  _id: v.id("familyMembers"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  userId: v.id("users"),
  role: v.union(v.literal("parent"), v.literal("guardian")),
  createdAt: v.number(),
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("families"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);
    const now = Date.now();

    const familyId = await ctx.db.insert("families", {
      name: args.name.trim(),
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.insert("familyMembers", {
      familyId,
      userId: user._id,
      role: "parent",
      createdAt: now,
    });

    if (!user.role || user.role === "student") {
      await ctx.db.patch("users", user._id, { role: "parent" });
    }

    return familyId;
  },
});

export const update = mutation({
  args: {
    familyId: v.id("families"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Family name is required");
    }
    await ctx.db.patch("families", args.familyId, { name });
    return null;
  },
});

export const remove = mutation({
  args: { familyId: v.id("families") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireFamilyAccess(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) {
      throw new Error("Family not found");
    }
    if (
      user.role !== "superAdmin" &&
      family.createdBy !== user._id
    ) {
      throw new Error("Only the family creator or superAdmin can delete");
    }
    await deleteFamilyCascade(ctx, args.familyId);
    return null;
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

export const listMembers = query({
  args: { familyId: v.id("families") },
  returns: v.array(
    v.object({
      membership: familyMemberDocValidator,
      email: v.optional(v.string()),
      name: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const members = await ctx.db
      .query("familyMembers")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    const result = [];
    for (const membership of members) {
      const u = await ctx.db.get("users", membership.userId);
      result.push({
        membership,
        email: u?.email,
        name: u?.name,
      });
    }
    return result;
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

export const removeMember = mutation({
  args: {
    familyId: v.id("families"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) {
      throw new Error("Family not found");
    }

    if (args.userId === family.createdBy) {
      throw new Error("Cannot remove the family creator");
    }

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", args.userId),
      )
      .unique();

    if (!membership) {
      throw new Error("Member not found");
    }

    await ctx.db.delete("familyMembers", membership._id);
    return null;
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
      name: args.name?.trim() || `${user.name ?? "Family"} Household`,
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
