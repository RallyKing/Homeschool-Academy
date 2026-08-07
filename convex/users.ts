import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireRole,
} from "./lib/auth";
import { familyDocValidator, roleValidator, userDocValidator } from "./lib/validators";

export const current = query({
  args: {},
  returns: v.union(userDocValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get("users", userId);
  },
});

export const setRole = mutation({
  args: { role: roleValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    // Only allow self-assignment of non-admin roles; superAdmin via seed/admin
    if (args.role === "superAdmin" && user.role !== "superAdmin") {
      throw new Error("Cannot self-assign superAdmin");
    }
    await ctx.db.patch("users", user._id, { role: args.role });
    return null;
  },
});

export const ensureFamilyForParent = mutation({
  args: {
    familyName: v.optional(v.string()),
  },
  returns: v.id("families"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);

    const existing = await getPrimaryFamilyForUser(ctx, user._id);
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const familyId = await ctx.db.insert("families", {
      name: args.familyName ?? `${user.name ?? "Family"} Household`,
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

export const myFamily = query({
  args: {},
  returns: v.union(familyDocValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return await getPrimaryFamilyForUser(ctx, user._id);
  },
});
