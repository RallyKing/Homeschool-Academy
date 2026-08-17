import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  deleteFamilyCascade,
  getCurrentUser,
  getPrimaryFamilyForUser,
  requireFamilyAccess,
  requireRole,
  requireSchoolAdmin,
} from "./lib/auth";
import { upsertEntityContact } from "./lib/contacts";
import { assertSchoolNameAvailable } from "./lib/schoolGuards";
import { familyDocValidator, schoolRoleValidator } from "./lib/validators";

const familyMemberDocValidator = v.object({
  _id: v.id("familyMembers"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  userId: v.id("users"),
  role: v.union(v.literal("parent"), v.literal("guardian")),
  schoolRole: v.optional(schoolRoleValidator),
  createdAt: v.number(),
});

export const create = mutation({
  args: { name: v.string(), allowDuplicateName: v.optional(v.boolean()) },
  returns: v.id("families"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["parent", "superAdmin"]);
    await assertSchoolNameAvailable(ctx, {
      name: args.name,
      allowDuplicateName: args.allowDuplicateName,
    });
    const now = Date.now();

    const familyId = await ctx.db.insert("families", {
      name: args.name.trim(),
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

    if (!user.role || user.role === "student") {
      await ctx.db.patch("users", user._id, { role: "parent" });
    }

    await upsertEntityContact(ctx, {
      kind: "school",
      familyId,
      displayName: args.name.trim(),
      roleLabel: "school",
    });
    await upsertEntityContact(ctx, {
      kind: "parent",
      familyId,
      userId: user._id,
      displayName: user.name || user.email || "Parent",
      emails: user.email ? [user.email] : [],
      roleLabel: "main",
    });

    return familyId;
  },
});

export const update = mutation({
  args: {
    familyId: v.id("families"),
    name: v.optional(v.string()),
    parentGuardrailContext: v.optional(v.string()),
    defaultPublicCheer: v.optional(v.boolean()),
    allowDuplicateName: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const patch: {
      name?: string;
      parentGuardrailContext?: string;
      defaultPublicCheer?: boolean;
    } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) {
        throw new Error("Family name is required");
      }
      await assertSchoolNameAvailable(ctx, {
        name,
        allowDuplicateName: args.allowDuplicateName,
        exceptFamilyId: args.familyId,
      });
      patch.name = name;
    }
    if (args.parentGuardrailContext !== undefined) {
      patch.parentGuardrailContext = args.parentGuardrailContext.trim();
    }
    if (args.defaultPublicCheer !== undefined) {
      patch.defaultPublicCheer = args.defaultPublicCheer;
    }

    if (Object.keys(patch).length === 0) {
      throw new Error("No changes provided");
    }

    await ctx.db.patch("families", args.familyId, patch);
    if (patch.name) {
      await upsertEntityContact(ctx, {
        kind: "school",
        familyId: args.familyId,
        displayName: patch.name,
        roleLabel: "school",
      });
    }
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
    const user = await getCurrentUser(ctx);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) return null;

    if (user.role === "superAdmin") {
      return family;
    }

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", user._id),
      )
      .unique();
    if (membership) {
      return family;
    }

    // Linked students may read their own family (settings / privacy defaults).
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (student && student.familyId === args.familyId) {
      return family;
    }

    throw new Error("Unauthorized: no access to this family");
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
    await requireSchoolAdmin(ctx, args.familyId);

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
      schoolRole: "regular",
      createdAt: Date.now(),
    });
  },
});

export const addMemberByEmail = mutation({
  args: {
    familyId: v.id("families"),
    email: v.string(),
    role: v.union(v.literal("parent"), v.literal("guardian")),
  },
  returns: v.id("familyMembers"),
  handler: async (ctx, args) => {
    await requireSchoolAdmin(ctx, args.familyId);
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new Error("Enter a valid email");
    }

    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (!target) {
      throw new Error(
        "No account found with that email. Have them sign up first.",
      );
    }

    const existing = await ctx.db
      .query("familyMembers")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", target._id),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    if (!target.role || target.role === "student") {
      await ctx.db.patch("users", target._id, { role: "parent" });
    }

    return await ctx.db.insert("familyMembers", {
      familyId: args.familyId,
      userId: target._id,
      role: args.role,
      schoolRole: "regular",
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
    await requireSchoolAdmin(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) {
      throw new Error("Family not found");
    }

    if (args.userId === family.createdBy || args.userId === family.mainParentUserId) {
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
    const name = args.name?.trim() || `${user.name ?? "Family"} Household`;
    await assertSchoolNameAvailable(ctx, { name });

    const familyId = await ctx.db.insert("families", {
      name,
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

    if (!user.role) {
      await ctx.db.patch("users", user._id, { role: "parent" });
    }

    await upsertEntityContact(ctx, {
      kind: "school",
      familyId,
      displayName: name,
      roleLabel: "school",
    });
    await upsertEntityContact(ctx, {
      kind: "parent",
      familyId,
      userId: user._id,
      displayName: user.name || user.email || "Parent",
      emails: user.email ? [user.email] : [],
      roleLabel: "main",
    });

    return familyId;
  },
});
