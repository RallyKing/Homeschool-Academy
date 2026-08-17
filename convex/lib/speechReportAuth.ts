import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  getFamilyMembership,
  getSchoolStaff,
  resolveSchoolRole,
  teacherHasStudentAccess,
} from "./auth";
import type { Infer } from "convex/values";
import { speechReporterRoleValidator } from "./validators";

type Ctx = QueryCtx | MutationCtx;
export type SpeechReporterRole = Infer<typeof speechReporterRoleValidator>;

export function normalizeSpeechWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/'/g, "");
}

export async function resolveReporterRole(
  ctx: Ctx,
  user: Doc<"users">,
  familyId?: Id<"families">,
  studentId?: Id<"students">,
): Promise<SpeechReporterRole | null> {
  if (user.role === "student") return null;
  if (user.role === "superAdmin") return "superAdmin";

  let resolvedFamilyId = familyId;
  let family: Doc<"families"> | null = null;
  if (resolvedFamilyId) {
    family = await ctx.db.get("families", resolvedFamilyId);
  } else if (studentId) {
    const student = await ctx.db.get("students", studentId);
    if (student) {
      family = await ctx.db.get("families", student.familyId);
      resolvedFamilyId = student.familyId;
    }
  }

  if (resolvedFamilyId) {
    const staff = await getSchoolStaff(ctx, resolvedFamilyId, user._id);
    if (staff?.memberKind === "tutor") return "tutor";
    if (staff?.memberKind === "teacher") return "teacher";

    if (studentId && (await teacherHasStudentAccess(ctx, user._id, studentId))) {
      return "teacher";
    }

    const membership = await getFamilyMembership(ctx, resolvedFamilyId, user._id);
    if (family && membership) {
      const schoolRole = resolveSchoolRole(membership, family, user._id);
      if (schoolRole === "main") return "family_main";
      if (schoolRole === "admin") return "family_admin";
      return "parent";
    }
  }

  if (user.role === "teacher") return "teacher";

  const academyMemberships = await ctx.db
    .query("academyMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .take(20);
  for (const row of academyMemberships) {
    if (row.memberKind === "tutor") return "tutor";
    if (row.role === "teacher" || row.role === "admin") return "teacher";
  }

  return null;
}
