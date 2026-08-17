import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  deleteAcademyCascade,
  getCurrentUser,
  getPrimaryAcademyForUser,
  getPrimaryFamilyForUser,
  requireAcademyAccess,
  requireFamilyAccess,
  requireRole,
} from "./lib/auth";

const academyDocValidator = v.object({
  _id: v.id("academies"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  description: v.optional(v.string()),
  createdAt: v.number(),
});

const subscriptionDocValidator = v.object({
  _id: v.id("familyAcademySubscriptions"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  academyId: v.id("academies"),
  status: v.union(
    v.literal("active"),
    v.literal("pending"),
    v.literal("cancelled"),
  ),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
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
    const name = args.name.trim();
    if (!name) throw new Error("Academy name is required");

    const academyId = await ctx.db.insert("academies", {
      name,
      description: args.description?.trim() || undefined,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.insert("academyMembers", {
      academyId,
      userId: user._id,
      role: "admin",
      memberKind: "teacher",
      createdAt: now,
    });

    if (!user.role || user.role === "student") {
      await ctx.db.patch("users", user._id, { role: "teacher" });
    }

    return academyId;
  },
});

export const ensureMine = mutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.id("academies"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["teacher", "superAdmin"]);
    const existing = await getPrimaryAcademyForUser(ctx, user._id);
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const academyId = await ctx.db.insert("academies", {
      name: args.name?.trim() || `${user.name ?? "Teacher"} Academy`,
      description: args.description?.trim() || undefined,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.insert("academyMembers", {
      academyId,
      userId: user._id,
      role: "admin",
      memberKind: "teacher",
      createdAt: now,
    });

    if (!user.role) {
      await ctx.db.patch("users", user._id, { role: "teacher" });
    }

    return academyId;
  },
});

export const update = mutation({
  args: {
    academyId: v.id("academies"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAcademyAccess(ctx, args.academyId);
    const patch: { name?: string; description?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Academy name is required");
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    await ctx.db.patch("academies", args.academyId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { academyId: v.id("academies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, academy } = await requireAcademyAccess(ctx, args.academyId);
    if (
      user.role !== "superAdmin" &&
      academy.createdBy !== user._id
    ) {
      throw new Error("Only the academy creator or superAdmin can delete");
    }
    await deleteAcademyCascade(ctx, args.academyId);
    return null;
  },
});

export const addMember = mutation({
  args: {
    academyId: v.id("academies"),
    userId: v.id("users"),
    role: v.union(v.literal("teacher"), v.literal("admin")),
  },
  returns: v.id("academyMembers"),
  handler: async (ctx, args) => {
    await requireAcademyAccess(ctx, args.academyId);

    const existing = await ctx.db
      .query("academyMembers")
      .withIndex("by_academy_and_user", (q) =>
        q.eq("academyId", args.academyId).eq("userId", args.userId),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("academyMembers", {
      academyId: args.academyId,
      userId: args.userId,
      role: args.role,
      memberKind: "teacher",
      createdAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    academyId: v.id("academies"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { academy } = await requireAcademyAccess(ctx, args.academyId);
    if (args.userId === academy.createdBy) {
      throw new Error("Cannot remove the academy creator");
    }

    const membership = await ctx.db
      .query("academyMembers")
      .withIndex("by_academy_and_user", (q) =>
        q.eq("academyId", args.academyId).eq("userId", args.userId),
      )
      .unique();

    if (!membership) {
      throw new Error("Member not found");
    }

    await ctx.db.delete("academyMembers", membership._id);
    return null;
  },
});

export const listMembers = query({
  args: { academyId: v.id("academies") },
  returns: v.array(
    v.object({
      membershipId: v.id("academyMembers"),
      userId: v.id("users"),
      role: v.union(v.literal("teacher"), v.literal("admin")),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAcademyAccess(ctx, args.academyId);
    const members = await ctx.db
      .query("academyMembers")
      .withIndex("by_academy", (q) => q.eq("academyId", args.academyId))
      .collect();

    const result = [];
    for (const m of members) {
      const u = await ctx.db.get("users", m.userId);
      result.push({
        membershipId: m._id,
        userId: m.userId,
        role: m.role,
        email: u?.email,
        name: u?.name,
        createdAt: m.createdAt,
      });
    }
    return result;
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

export const listBrowsable = query({
  args: {},
  returns: v.array(academyDocValidator),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.db.query("academies").take(100);
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
    familyId: v.optional(v.id("families")),
    academyId: v.id("academies"),
  },
  returns: v.id("familyAcademySubscriptions"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);

    let familyId = args.familyId;
    if (!familyId) {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (!family) {
        throw new Error("Create a family before subscribing to academies");
      }
      familyId = family._id;
    }

    await requireFamilyAccess(ctx, familyId);

    const academy = await ctx.db.get("academies", args.academyId);
    if (!academy) {
      throw new Error("Academy not found");
    }

    const existing = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_family_and_academy", (q) =>
        q.eq("familyId", familyId).eq("academyId", args.academyId),
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
      familyId,
      academyId: args.academyId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const unsubscribeFamily = mutation({
  args: {
    familyId: v.optional(v.id("families")),
    academyId: v.id("academies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);

    let familyId = args.familyId;
    if (!familyId) {
      const family = await getPrimaryFamilyForUser(ctx, user._id);
      if (!family) throw new Error("No family found");
      familyId = family._id;
    }

    await requireFamilyAccess(ctx, familyId);

    const existing = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_family_and_academy", (q) =>
        q.eq("familyId", familyId).eq("academyId", args.academyId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch("familyAcademySubscriptions", existing._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const mySubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      subscription: subscriptionDocValidator,
      academy: academyDocValidator,
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const family = await getPrimaryFamilyForUser(ctx, user._id);
    if (!family) {
      return [];
    }

    const subs = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    const result = [];
    for (const subscription of subs) {
      if (subscription.status !== "active") continue;
      const academy = await ctx.db.get("academies", subscription.academyId);
      if (academy) {
        result.push({ subscription, academy });
      }
    }
    return result;
  },
});

export const listSubscribers = query({
  args: { academyId: v.id("academies") },
  returns: v.array(
    v.object({
      subscriptionId: v.id("familyAcademySubscriptions"),
      familyId: v.id("families"),
      familyName: v.string(),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAcademyAccess(ctx, args.academyId);

    const subs = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_academy", (q) => q.eq("academyId", args.academyId))
      .collect();

    const result = [];
    for (const sub of subs) {
      if (sub.status !== "active") continue;
      const family = await ctx.db.get("families", sub.familyId);
      if (family) {
        result.push({
          subscriptionId: sub._id,
          familyId: family._id,
          familyName: family.name,
          status: sub.status,
          createdAt: sub.createdAt,
        });
      }
    }
    return result;
  },
});
