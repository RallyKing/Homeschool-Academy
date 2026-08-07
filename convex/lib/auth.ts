import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type AppRole = "superAdmin" | "parent" | "teacher" | "student";

export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get("users", userId);
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function getCurrentUserOrNull(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get("users", userId);
}

export async function requireRole(
  ctx: Ctx,
  roles: AppRole[],
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  const role = user.role ?? "parent";
  if (!roles.includes(role)) {
    throw new Error(`Unauthorized: requires one of [${roles.join(", ")}]`);
  }
  return user;
}

export async function requireSuperAdmin(ctx: Ctx): Promise<Doc<"users">> {
  return await requireRole(ctx, ["superAdmin"]);
}

export async function getFamilyMembership(
  ctx: Ctx,
  familyId: Id<"families">,
  userId: Id<"users">,
): Promise<Doc<"familyMembers"> | null> {
  return await ctx.db
    .query("familyMembers")
    .withIndex("by_family_and_user", (q) =>
      q.eq("familyId", familyId).eq("userId", userId),
    )
    .unique();
}

export async function requireFamilyAccess(
  ctx: Ctx,
  familyId: Id<"families">,
): Promise<{
  user: Doc<"users">;
  membership: Doc<"familyMembers"> | null;
}> {
  const user = await getCurrentUser(ctx);
  const family = await ctx.db.get("families", familyId);
  if (!family) {
    throw new Error("Family not found");
  }

  if (user.role === "superAdmin") {
    const membership = await getFamilyMembership(ctx, familyId, user._id);
    return { user, membership };
  }

  const membership = await getFamilyMembership(ctx, familyId, user._id);
  if (!membership) {
    throw new Error("Unauthorized: not a member of this family");
  }
  return { user, membership };
}

export async function requireStudentFamilyAccess(
  ctx: Ctx,
  studentId: Id<"students">,
): Promise<{
  user: Doc<"users">;
  student: Doc<"students">;
}> {
  const user = await getCurrentUser(ctx);
  const student = await ctx.db.get("students", studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  if (user.role === "superAdmin") {
    return { user, student };
  }

  if (student.userId === user._id) {
    return { user, student };
  }

  const membership = await getFamilyMembership(ctx, student.familyId, user._id);
  if (!membership) {
    throw new Error("Unauthorized: no access to this student");
  }

  return { user, student };
}

export async function getPrimaryFamilyForUser(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Doc<"families"> | null> {
  const membership = await ctx.db
    .query("familyMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!membership) {
    return null;
  }

  return await ctx.db.get("families", membership.familyId);
}
