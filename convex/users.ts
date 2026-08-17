import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUser,
  getCurrentUserOrNull,
  getPrimaryAcademyForUser,
  getPrimaryFamilyForUser,
  requireRole,
} from "./lib/auth";
import {
  familyDocValidator,
  roleValidator,
  userDocValidator,
} from "./lib/validators";

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
      mainParentUserId: user._id,
      createdAt: now,
    });

    await ctx.db.insert("familyMembers", {
      familyId,
      userId: user._id,
      role: "parent",
      schoolRole: "main",
      createdAt: now,
    });

    return familyId;
  },
});

export const myFamily = query({
  args: {},
  returns: v.union(familyDocValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    return await getPrimaryFamilyForUser(ctx, user._id);
  },
});

export const onboardingStatus = query({
  args: {},
  returns: v.object({
    role: v.union(roleValidator, v.null()),
    needsOnboarding: v.boolean(),
    hasFamily: v.boolean(),
    hasAcademy: v.boolean(),
    hasStudentProfile: v.boolean(),
    homePath: v.string(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const role = user.role ?? null;
    const family = await getPrimaryFamilyForUser(ctx, user._id);
    const academy = await getPrimaryAcademyForUser(ctx, user._id);

    const linkedStudent = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    let needsOnboarding = false;
    let homePath = "/family/dashboard";

    if (role === "superAdmin") {
      homePath = "/admin";
      needsOnboarding = false;
    } else if (role === "teacher") {
      const staff = await ctx.db
        .query("schoolStaff")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      homePath = academy || staff ? "/academy/dashboard" : "/onboarding";
      needsOnboarding = !academy && !staff;
    } else if (role === "student") {
      homePath = "/student/dashboard";
      needsOnboarding = false;
    } else {
      // parent (default)
      homePath = family ? "/family/dashboard" : "/onboarding";
      needsOnboarding = !family;
    }

    return {
      role,
      needsOnboarding,
      hasFamily: family !== null,
      hasAcademy: academy !== null,
      hasStudentProfile: linkedStudent !== null,
      homePath,
    };
  },
});
