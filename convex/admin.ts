import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  deleteAcademyCascade,
  deleteFamilyCascade,
  getCurrentUser,
  requireSuperAdmin,
} from "./lib/auth";
import {
  familyDocValidator,
  roleValidator,
  subjectCategoryValidator,
  subjectDocValidator,
  userDocValidator,
} from "./lib/validators";

const academyDocValidator = v.object({
  _id: v.id("academies"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  description: v.optional(v.string()),
  createdAt: v.number(),
});

async function deleteAuthForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) {
      await ctx.db.delete("authRefreshTokens", token._id);
    }
    await ctx.db.delete("authSessions", session._id);
  }

  // Accounts are indexed by userId+provider; collect via filter on take.
  const accounts = await ctx.db.query("authAccounts").take(500);
  for (const account of accounts) {
    if (account.userId !== userId) continue;
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) {
      await ctx.db.delete("authVerificationCodes", code._id);
    }
    await ctx.db.delete("authAccounts", account._id);
  }
}

async function deleteUserMemberships(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const familyMembers = await ctx.db
    .query("familyMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const member of familyMembers) {
    await ctx.db.delete("familyMembers", member._id);
  }

  const academyMembers = await ctx.db
    .query("academyMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const member of academyMembers) {
    await ctx.db.delete("academyMembers", member._id);
  }

  const settings = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const row of settings) {
    await ctx.db.delete("userSettings", row._id);
  }

  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_user", (q) => q.eq("recipientUserId", userId))
    .collect();
  for (const alert of alerts) {
    await ctx.db.delete("alerts", alert._id);
  }

  const linkedStudents = await ctx.db
    .query("students")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const student of linkedStudents) {
    await ctx.db.patch("students", student._id, { userId: undefined });
  }
}

export const listUsers = query({
  args: {},
  returns: v.array(userDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("users").take(200);
  },
});

export const listFamilies = query({
  args: {},
  returns: v.array(familyDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("families").take(200);
  },
});

export const listAcademies = query({
  args: {},
  returns: v.array(academyDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("academies").take(200);
  },
});

export const listPlatformSubjects = query({
  args: {},
  returns: v.array(subjectDocValidator),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const subjects = await ctx.db.query("subjects").take(200);
    return subjects
      .filter((s) => s.familyId === undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const overview = query({
  args: {},
  returns: v.object({
    userCount: v.number(),
    familyCount: v.number(),
    academyCount: v.number(),
    studentCount: v.number(),
    courseCount: v.number(),
    logCount: v.number(),
    subjectCount: v.number(),
    usersByRole: v.object({
      superAdmin: v.number(),
      parent: v.number(),
      teacher: v.number(),
      student: v.number(),
      unset: v.number(),
    }),
  }),
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const users = await ctx.db.query("users").take(500);
    const families = await ctx.db.query("families").take(500);
    const academies = await ctx.db.query("academies").take(500);
    const students = await ctx.db.query("students").take(500);
    const courses = await ctx.db.query("courses").take(500);
    const logs = await ctx.db.query("logs").take(500);
    const subjects = await ctx.db.query("subjects").take(200);
    const platformSubjects = subjects.filter((s) => s.familyId === undefined);

    const usersByRole = {
      superAdmin: 0,
      parent: 0,
      teacher: 0,
      student: 0,
      unset: 0,
    };

    for (const u of users) {
      if (u.role === "superAdmin") usersByRole.superAdmin += 1;
      else if (u.role === "parent") usersByRole.parent += 1;
      else if (u.role === "teacher") usersByRole.teacher += 1;
      else if (u.role === "student") usersByRole.student += 1;
      else usersByRole.unset += 1;
    }

    return {
      userCount: users.length,
      familyCount: families.length,
      academyCount: academies.length,
      studentCount: students.length,
      courseCount: courses.length,
      logCount: logs.length,
      subjectCount: platformSubjects.length,
      usersByRole,
    };
  },
});

/** Pre-provision a user row (no auth credentials). They can sign up later with this email. */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: roleValidator,
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Valid email is required");
    }
    if (args.role === "superAdmin") {
      throw new Error("Use Promote or Edit to grant superAdmin");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      throw new Error("A user with that email already exists");
    }

    return await ctx.db.insert("users", {
      email,
      name: args.name?.trim() || undefined,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(roleValidator),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new Error("User not found");
    }

    const patch: {
      role?: typeof args.role;
      name?: string;
      email?: string;
    } = {};

    if (args.role !== undefined) {
      if (
        target.role === "superAdmin" &&
        args.role !== "superAdmin" &&
        target._id === admin._id
      ) {
        throw new Error("You cannot demote yourself");
      }
      if (target.role === "superAdmin" && args.role !== "superAdmin") {
        const admins = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
          .take(5);
        if (admins.length <= 1) {
          throw new Error("Cannot demote the last superAdmin");
        }
      }
      patch.role = args.role;
    }

    if (args.name !== undefined) {
      patch.name = args.name.trim() || undefined;
    }

    if (args.email !== undefined) {
      const email = args.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        throw new Error("Valid email is required");
      }
      const conflict = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (conflict && conflict._id !== args.userId) {
        throw new Error("A user with that email already exists");
      }
      patch.email = email;
    }

    if (Object.keys(patch).length === 0) {
      throw new Error("No changes provided");
    }

    await ctx.db.patch("users", args.userId, patch);
    return null;
  },
});

export const removeUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    if (args.userId === admin._id) {
      throw new Error("You cannot delete yourself");
    }

    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new Error("User not found");
    }

    if (target.role === "superAdmin") {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
        .take(5);
      if (admins.length <= 1) {
        throw new Error("Cannot delete the last superAdmin");
      }
    }

    // Reassign org ownership so createdBy stays valid.
    const ownedFamilies = await ctx.db
      .query("families")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const family of ownedFamilies) {
      await ctx.db.patch("families", family._id, { createdBy: admin._id });
    }

    const ownedAcademies = await ctx.db
      .query("academies")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const academy of ownedAcademies) {
      await ctx.db.patch("academies", academy._id, { createdBy: admin._id });
    }

    await deleteUserMemberships(ctx, args.userId);
    await deleteAuthForUser(ctx, args.userId);
    await ctx.db.delete("users", args.userId);
    return null;
  },
});

export const promoteToSuperAdmin = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new Error("User not found");
    }
    await ctx.db.patch("users", args.userId, { role: "superAdmin" });
    return null;
  },
});

export const createFamily = mutation({
  args: { name: v.string() },
  returns: v.id("families"),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Family name is required");

    return await ctx.db.insert("families", {
      name,
      createdBy: admin._id,
      createdAt: Date.now(),
    });
  },
});

export const updateFamily = mutation({
  args: {
    familyId: v.id("families"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Family not found");

    const name = args.name.trim();
    if (!name) throw new Error("Family name is required");

    await ctx.db.patch("families", args.familyId, { name });
    return null;
  },
});

export const removeFamily = mutation({
  args: { familyId: v.id("families") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Family not found");
    await deleteFamilyCascade(ctx, args.familyId);
    return null;
  },
});

export const createAcademy = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("academies"),
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Academy name is required");

    return await ctx.db.insert("academies", {
      name,
      description: args.description?.trim() || undefined,
      createdBy: admin._id,
      createdAt: Date.now(),
    });
  },
});

export const updateAcademy = mutation({
  args: {
    academyId: v.id("academies"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const academy = await ctx.db.get("academies", args.academyId);
    if (!academy) throw new Error("Academy not found");

    const name = args.name.trim();
    if (!name) throw new Error("Academy name is required");

    await ctx.db.patch("academies", args.academyId, {
      name,
      description: args.description?.trim() || undefined,
    });
    return null;
  },
});

export const removeAcademy = mutation({
  args: { academyId: v.id("academies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const academy = await ctx.db.get("academies", args.academyId);
    if (!academy) throw new Error("Academy not found");
    await deleteAcademyCascade(ctx, args.academyId);
    return null;
  },
});

export const createSubject = mutation({
  args: {
    name: v.string(),
    category: subjectCategoryValidator,
  },
  returns: v.id("subjects"),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Subject name is required");

    const existing = await ctx.db.query("subjects").take(200);
    const conflict = existing.some(
      (s) =>
        s.familyId === undefined &&
        s.name.toLowerCase() === name.toLowerCase(),
    );
    if (conflict) {
      throw new Error("A platform subject with that name already exists");
    }

    return await ctx.db.insert("subjects", {
      name,
      category: args.category,
      createdAt: Date.now(),
    });
  },
});

export const updateSubject = mutation({
  args: {
    subjectId: v.id("subjects"),
    name: v.string(),
    category: subjectCategoryValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) throw new Error("Subject not found");
    if (subject.familyId !== undefined) {
      throw new Error("Only platform subjects can be edited here");
    }

    const name = args.name.trim();
    if (!name) throw new Error("Subject name is required");

    const existing = await ctx.db.query("subjects").take(200);
    const conflict = existing.some(
      (s) =>
        s.familyId === undefined &&
        s._id !== args.subjectId &&
        s.name.toLowerCase() === name.toLowerCase(),
    );
    if (conflict) {
      throw new Error("A platform subject with that name already exists");
    }

    await ctx.db.patch("subjects", args.subjectId, {
      name,
      category: args.category,
    });
    return null;
  },
});

export const removeSubject = mutation({
  args: { subjectId: v.id("subjects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const subject = await ctx.db.get("subjects", args.subjectId);
    if (!subject) throw new Error("Subject not found");
    if (subject.familyId !== undefined) {
      throw new Error("Only platform subjects can be deleted here");
    }

    const inUse = await ctx.db
      .query("courses")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .first();
    if (inUse) {
      throw new Error("Cannot delete subject while courses still reference it");
    }

    // Clear soft-hide references from families.
    const families = await ctx.db.query("families").take(500);
    for (const family of families) {
      const hidden = family.hiddenSubjectIds;
      if (!hidden?.includes(args.subjectId)) continue;
      await ctx.db.patch("families", family._id, {
        hiddenSubjectIds: hidden.filter((id) => id !== args.subjectId),
      });
    }

    await ctx.db.delete("subjects", args.subjectId);
    return null;
  },
});

export const bootstrapSuperAdmin = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingAdmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
      .take(1);

    if (existingAdmins.length > 0) {
      throw new Error("A superAdmin already exists");
    }

    const user = await getCurrentUser(ctx);
    await ctx.db.patch("users", user._id, { role: "superAdmin" });
    return null;
  },
});
