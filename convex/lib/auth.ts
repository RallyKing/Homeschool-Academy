import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { deleteAlertsForFamily, deleteAlertsForStudent } from "./alerts";
import {
  deleteGamificationForStudent,
  deleteRewardsForFamily,
} from "./gamificationCore";
import { deleteBadgeProposalsForStudent } from "./aiCore";
import { deleteFeedForFamily, deleteFeedForStudent } from "./feed";
import { deleteSocialForStudent } from "./socialCore";
import {
  deleteContactsForFamily,
  deleteContactsForStudent,
} from "./contacts";

type Ctx = QueryCtx | MutationCtx;

export type AppRole = "superAdmin" | "parent" | "teacher" | "student";
export type SchoolRole = "main" | "admin" | "regular";

export function resolveSchoolRole(
  membership: Doc<"familyMembers"> | null,
  family: Doc<"families">,
  userId: Id<"users">,
): SchoolRole | null {
  if (!membership) return null;
  if (membership.schoolRole) return membership.schoolRole;
  if (family.mainParentUserId === userId || family.createdBy === userId) {
    return "main";
  }
  return "regular";
}

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

export async function getSchoolStaff(
  ctx: Ctx,
  familyId: Id<"families">,
  userId: Id<"users">,
): Promise<Doc<"schoolStaff"> | null> {
  return await ctx.db
    .query("schoolStaff")
    .withIndex("by_family_and_user", (q) =>
      q.eq("familyId", familyId).eq("userId", userId),
    )
    .unique();
}

export async function teacherHasStudentAccess(
  ctx: Ctx,
  teacherUserId: Id<"users">,
  studentId: Id<"students">,
): Promise<boolean> {
  const row = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_teacher_and_student", (q) =>
      q.eq("teacherUserId", teacherUserId).eq("studentId", studentId),
    )
    .unique();
  return row !== null;
}

export async function teacherHasCourseAccess(
  ctx: Ctx,
  teacherUserId: Id<"users">,
  courseId: Id<"courses">,
): Promise<boolean> {
  const row = await ctx.db
    .query("teacherCourseAccess")
    .withIndex("by_teacher_and_course", (q) =>
      q.eq("teacherUserId", teacherUserId).eq("courseId", courseId),
    )
    .unique();
  return row !== null;
}

export async function listAssignedStudentIds(
  ctx: Ctx,
  teacherUserId: Id<"users">,
  familyId?: Id<"families">,
): Promise<Id<"students">[]> {
  const rows = familyId
    ? await ctx.db
        .query("teacherStudentAccess")
        .withIndex("by_family_and_teacher", (q) =>
          q.eq("familyId", familyId).eq("teacherUserId", teacherUserId),
        )
        .collect()
    : await ctx.db
        .query("teacherStudentAccess")
        .withIndex("by_teacher", (q) => q.eq("teacherUserId", teacherUserId))
        .collect();
  return rows.map((r) => r.studentId);
}

export async function listAssignedCourseIds(
  ctx: Ctx,
  teacherUserId: Id<"users">,
  familyId?: Id<"families">,
): Promise<Id<"courses">[]> {
  const rows = familyId
    ? await ctx.db
        .query("teacherCourseAccess")
        .withIndex("by_family_and_teacher", (q) =>
          q.eq("familyId", familyId).eq("teacherUserId", teacherUserId),
        )
        .collect()
    : await ctx.db
        .query("teacherCourseAccess")
        .withIndex("by_teacher", (q) => q.eq("teacherUserId", teacherUserId))
        .collect();
  return rows.map((r) => r.courseId);
}

export async function requireSchoolAdmin(
  ctx: Ctx,
  familyId: Id<"families">,
): Promise<{
  user: Doc<"users">;
  family: Doc<"families">;
  membership: Doc<"familyMembers"> | null;
  schoolRole: SchoolRole | "superAdmin";
}> {
  const { user, membership } = await requireFamilyAccess(ctx, familyId);
  const family = await ctx.db.get("families", familyId);
  if (!family) {
    throw new Error("School not found");
  }
  if (user.role === "superAdmin") {
    return { user, family, membership, schoolRole: "superAdmin" };
  }
  const schoolRole = resolveSchoolRole(membership, family, user._id);
  if (schoolRole !== "main" && schoolRole !== "admin") {
    throw new Error("Unauthorized: school admin or main parent required");
  }
  return { user, family, membership, schoolRole };
}

export async function requireParentOrSchoolAdmin(
  ctx: Ctx,
  familyId: Id<"families">,
): Promise<{
  user: Doc<"users">;
  family: Doc<"families">;
  membership: Doc<"familyMembers"> | null;
  schoolRole: SchoolRole | "superAdmin";
}> {
  const { user, membership } = await requireFamilyAccess(ctx, familyId);
  const family = await ctx.db.get("families", familyId);
  if (!family) {
    throw new Error("School not found");
  }
  if (user.role === "superAdmin") {
    return { user, family, membership, schoolRole: "superAdmin" };
  }
  const schoolRole = resolveSchoolRole(membership, family, user._id);
  if (!schoolRole) {
    throw new Error("Unauthorized: not a parent of this school");
  }
  return { user, family, membership, schoolRole };
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
  if (membership) {
    return { user, student };
  }

  if (await teacherHasStudentAccess(ctx, user._id, studentId)) {
    return { user, student };
  }

  throw new Error("Unauthorized: no access to this student");
}

/**
 * Parent (or superAdmin) may view the app as a student in their family.
 * Does not switch auth sessions â€” caller remains the parent user.
 */
export async function assertParentOfStudent(
  ctx: Ctx,
  studentId: Id<"students">,
): Promise<{
  user: Doc<"users">;
  student: Doc<"students">;
  membership: Doc<"familyMembers"> | null;
}> {
  const user = await getCurrentUser(ctx);
  const student = await ctx.db.get("students", studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  if (user.role === "superAdmin") {
    const membership = await getFamilyMembership(
      ctx,
      student.familyId,
      user._id,
    );
    return { user, student, membership };
  }

  const role = user.role ?? "parent";
  if (role !== "parent") {
    throw new Error("Unauthorized: only parents can view as a student");
  }

  const membership = await getFamilyMembership(ctx, student.familyId, user._id);
  if (!membership) {
    throw new Error("Unauthorized: not a parent of this student");
  }

  return { user, student, membership };
}

/**
 * True when the user may view/participate on a family's Cheer Wall:
 * family member, linked student, or teacher at an academy the family
 * actively subscribes to.
 */
export async function userHasFeedCircleAccess(
  ctx: Ctx,
  familyId: Id<"families">,
  user: Doc<"users">,
): Promise<boolean> {
  if (user.role === "superAdmin") return true;

  const membership = await getFamilyMembership(ctx, familyId, user._id);
  if (membership) return true;

  const linked = await ctx.db
    .query("students")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (linked && linked.familyId === familyId) return true;

  const academyMemberships = await ctx.db
    .query("academyMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  for (const am of academyMemberships) {
    const sub = await ctx.db
      .query("familyAcademySubscriptions")
      .withIndex("by_family_and_academy", (q) =>
        q.eq("familyId", familyId).eq("academyId", am.academyId),
      )
      .unique();
    if (sub && sub.status === "active") return true;
  }

  const staff = await getSchoolStaff(ctx, familyId, user._id);
  if (staff) return true;

  return false;
}

/** Family access OR linked student belonging to that family OR subscribed academy teacher */
export async function requireFamilyReadAccess(
  ctx: Ctx,
  familyId: Id<"families">,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  const family = await ctx.db.get("families", familyId);
  if (!family) {
    throw new Error("Family not found");
  }

  if (await userHasFeedCircleAccess(ctx, familyId, user)) {
    return user;
  }

  throw new Error("Unauthorized: not a member of this family");
}

/** Same circle as read access — for react / comment / cheer participation. */
export async function requireFeedCircleAccess(
  ctx: Ctx,
  familyId: Id<"families">,
): Promise<Doc<"users">> {
  return await requireFamilyReadAccess(ctx, familyId);
}

export async function getPrimaryFamilyForUser(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Doc<"families"> | null> {
  const membership = await ctx.db
    .query("familyMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (membership) {
    return await ctx.db.get("families", membership.familyId);
  }

  const staff = await ctx.db
    .query("schoolStaff")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (staff) {
    return await ctx.db.get("families", staff.familyId);
  }

  return null;
}

export async function getAcademyMembership(
  ctx: Ctx,
  academyId: Id<"academies">,
  userId: Id<"users">,
): Promise<Doc<"academyMembers"> | null> {
  return await ctx.db
    .query("academyMembers")
    .withIndex("by_academy_and_user", (q) =>
      q.eq("academyId", academyId).eq("userId", userId),
    )
    .unique();
}

export async function requireAcademyAccess(
  ctx: Ctx,
  academyId: Id<"academies">,
): Promise<{
  user: Doc<"users">;
  membership: Doc<"academyMembers"> | null;
  academy: Doc<"academies">;
}> {
  const user = await getCurrentUser(ctx);
  const academy = await ctx.db.get("academies", academyId);
  if (!academy) {
    throw new Error("Academy not found");
  }

  if (user.role === "superAdmin") {
    const membership = await getAcademyMembership(ctx, academyId, user._id);
    return { user, membership, academy };
  }

  const membership = await getAcademyMembership(ctx, academyId, user._id);
  if (!membership) {
    throw new Error("Unauthorized: not a member of this academy");
  }
  return { user, membership, academy };
}

export async function getPrimaryAcademyForUser(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Doc<"academies"> | null> {
  const membership = await ctx.db
    .query("academyMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (!membership) {
    return null;
  }

  return await ctx.db.get("academies", membership.academyId);
}

/** Parent/teacher/admin with write access to a course's owning family or academy. */
export async function requireCourseWriteAccess(
  ctx: Ctx,
  courseId: Id<"courses">,
): Promise<{ user: Doc<"users">; course: Doc<"courses"> }> {
  const user = await getCurrentUser(ctx);
  const course = await ctx.db.get("courses", courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  if (user.role === "superAdmin") {
    return { user, course };
  }

  if (course.familyId) {
    await requireFamilyAccess(ctx, course.familyId);
    return { user, course };
  }

  if (course.academyId) {
    await requireAcademyAccess(ctx, course.academyId);
    return { user, course };
  }

  throw new Error("Unauthorized: course has no owner");
}

export async function deleteLessonsForModule(
  ctx: MutationCtx,
  moduleId: Id<"modules">,
): Promise<void> {
  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_module", (q) => q.eq("moduleId", moduleId))
    .collect();
  for (const lesson of lessons) {
    await ctx.db.delete("lessons", lesson._id);
  }
}

export async function deleteModulesForCourse(
  ctx: MutationCtx,
  courseId: Id<"courses">,
): Promise<void> {
  const modules = await ctx.db
    .query("modules")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const mod of modules) {
    await deleteLessonsForModule(ctx, mod._id);
    await ctx.db.delete("modules", mod._id);
  }
}

export async function deleteScheduleItems(
  ctx: MutationCtx,
  scheduleId: Id<"schedules">,
): Promise<void> {
  const items = await ctx.db
    .query("scheduleItems")
    .withIndex("by_schedule", (q) => q.eq("scheduleId", scheduleId))
    .collect();
  for (const item of items) {
    await ctx.db.delete("scheduleItems", item._id);
  }
}

export async function deleteStudentData(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  await deleteAlertsForStudent(ctx, studentId);
  await deleteGamificationForStudent(ctx, studentId);
  await deleteSocialForStudent(ctx, studentId);
  await deleteBadgeProposalsForStudent(ctx, studentId);

  const student = await ctx.db.get("students", studentId);
  if (student) {
    await deleteFeedForStudent(ctx, studentId, student.familyId);
  }

  const logs = await ctx.db
    .query("logs")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const log of logs) {
    await ctx.db.delete("logs", log._id);
  }

  const schedules = await ctx.db
    .query("schedules")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const schedule of schedules) {
    await deleteScheduleItems(ctx, schedule._id);
    await ctx.db.delete("schedules", schedule._id);
  }

  const studentAccess = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const row of studentAccess) {
    await ctx.db.delete("teacherStudentAccess", row._id);
  }

  await deleteContactsForStudent(ctx, studentId);

  if (student?.imageStorageId) {
    await ctx.storage.delete(student.imageStorageId);
  }

  await ctx.db.delete("students", studentId);
}

export async function deleteCourseCascade(
  ctx: MutationCtx,
  courseId: Id<"courses">,
): Promise<void> {
  const courseAccess = await ctx.db
    .query("teacherCourseAccess")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const row of courseAccess) {
    await ctx.db.delete("teacherCourseAccess", row._id);
  }
  const contactLinks = await ctx.db
    .query("contactCourseLinks")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const link of contactLinks) {
    await ctx.db.delete("contactCourseLinks", link._id);
  }
  await deleteModulesForCourse(ctx, courseId);
  await ctx.db.delete("courses", courseId);
}

export async function deleteFamilyCascade(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const students = await ctx.db
    .query("students")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const student of students) {
    await deleteStudentData(ctx, student._id);
  }

  await deleteAlertsForFamily(ctx, familyId);
  await deleteRewardsForFamily(ctx, familyId);
  await deleteFeedForFamily(ctx, familyId);

  const courses = await ctx.db
    .query("courses")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const course of courses) {
    const courseAccess = await ctx.db
      .query("teacherCourseAccess")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();
    for (const row of courseAccess) {
      await ctx.db.delete("teacherCourseAccess", row._id);
    }
    await deleteCourseCascade(ctx, course._id);
  }

  const teacherAccess = await ctx.db
    .query("teacherStudentAccess")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const row of teacherAccess) {
    await ctx.db.delete("teacherStudentAccess", row._id);
  }

  const remainingCourseAccess = await ctx.db
    .query("teacherCourseAccess")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const row of remainingCourseAccess) {
    await ctx.db.delete("teacherCourseAccess", row._id);
  }

  const staff = await ctx.db
    .query("schoolStaff")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const row of staff) {
    await ctx.db.delete("schoolStaff", row._id);
  }

  await deleteContactsForFamily(ctx, familyId);

  const subs = await ctx.db
    .query("familyAcademySubscriptions")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const sub of subs) {
    await ctx.db.delete("familyAcademySubscriptions", sub._id);
  }

  const members = await ctx.db
    .query("familyMembers")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const member of members) {
    await ctx.db.delete("familyMembers", member._id);
  }

  await ctx.db.delete("families", familyId);
}

export async function deleteAcademyCascade(
  ctx: MutationCtx,
  academyId: Id<"academies">,
): Promise<void> {
  const courses = await ctx.db
    .query("courses")
    .withIndex("by_academy", (q) => q.eq("academyId", academyId))
    .collect();
  for (const course of courses) {
    await deleteCourseCascade(ctx, course._id);
  }

  const subs = await ctx.db
    .query("familyAcademySubscriptions")
    .withIndex("by_academy", (q) => q.eq("academyId", academyId))
    .collect();
  for (const sub of subs) {
    await ctx.db.delete("familyAcademySubscriptions", sub._id);
  }

  const members = await ctx.db
    .query("academyMembers")
    .withIndex("by_academy", (q) => q.eq("academyId", academyId))
    .collect();
  for (const member of members) {
    await ctx.db.delete("academyMembers", member._id);
  }

  await ctx.db.delete("academies", academyId);
}
