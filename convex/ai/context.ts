import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  requireFamilyAccess,
  requireStudentFamilyAccess,
} from "../lib/auth";
import { ageBandFromBirthYear, ageBandValidator } from "./types";

const studentStatsValidator = v.object({
  studentId: v.id("students"),
  familyId: v.id("families"),
  displayName: v.string(),
  birthYear: v.optional(v.number()),
  academicLevel: v.optional(v.string()),
  ageBand: ageBandValidator,
  xp: v.number(),
  level: v.number(),
  points: v.number(),
  stars: v.number(),
  currentStreak: v.number(),
  totalLogs: v.number(),
  totalChoresCompleted: v.number(),
  totalMinutesLogged: v.number(),
  distinctSubjectsLogged: v.number(),
  existingBadgeKeys: v.array(v.string()),
  existingBadgeTitles: v.array(v.string()),
});

/** Context for badge_craft — fetched by the action via runQuery. */
export const getBadgeCraftContext = query({
  args: {
    studentId: v.id("students"),
    referenceYear: v.number(),
  },
  returns: studentStatsValidator,
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const g = await ctx.db
      .query("studentGamification")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .unique();

    const earned = await ctx.db
      .query("studentBadges")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();

    const existingBadgeKeys: string[] = [];
    const existingBadgeTitles: string[] = [];
    for (const e of earned) {
      const badge = await ctx.db.get("badges", e.badgeId);
      if (badge) {
        existingBadgeKeys.push(badge.key);
        existingBadgeTitles.push(badge.title);
      }
    }

    return {
      studentId: student._id,
      familyId: student.familyId,
      displayName: student.displayName,
      birthYear: student.birthYear,
      academicLevel: student.academicLevel,
      ageBand: ageBandFromBirthYear(student.birthYear, args.referenceYear),
      xp: g?.xp ?? 0,
      level: g?.level ?? 1,
      points: g?.points ?? 0,
      stars: g?.stars ?? 0,
      currentStreak: g?.currentStreak ?? 0,
      totalLogs: g?.totalLogs ?? 0,
      totalChoresCompleted: g?.totalChoresCompleted ?? 0,
      totalMinutesLogged: g?.totalMinutesLogged ?? 0,
      distinctSubjectsLogged: g?.distinctSubjectsLogged ?? 0,
      existingBadgeKeys,
      existingBadgeTitles,
    };
  },
});

export const getCourseAssistContext = query({
  args: {
    courseId: v.id("courses"),
    studentId: v.id("students"),
    referenceYear: v.number(),
  },
  returns: v.object({
    courseTitle: v.string(),
    courseType: v.string(),
    subjectCategory: v.optional(v.string()),
    student: studentStatsValidator,
  }),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const course = await ctx.db.get("courses", args.courseId);
    if (!course) throw new Error("Course not found");

    // Student must belong to the course's family when family-owned
    if (course.familyId && course.familyId !== student.familyId) {
      await requireFamilyAccess(ctx, student.familyId);
      // Still allow academy courses subscribed by family — soft check
    }

    const subject = await ctx.db.get("subjects", course.subjectId);
    const base = await ctx.db
      .query("studentGamification")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .unique();

    return {
      courseTitle: course.title,
      courseType: course.type,
      subjectCategory: subject?.category,
      student: {
        studentId: student._id,
        familyId: student.familyId,
        displayName: student.displayName,
        birthYear: student.birthYear,
        academicLevel: student.academicLevel,
        ageBand: ageBandFromBirthYear(student.birthYear, args.referenceYear),
        xp: base?.xp ?? 0,
        level: base?.level ?? 1,
        points: base?.points ?? 0,
        stars: base?.stars ?? 0,
        currentStreak: base?.currentStreak ?? 0,
        totalLogs: base?.totalLogs ?? 0,
        totalChoresCompleted: base?.totalChoresCompleted ?? 0,
        totalMinutesLogged: base?.totalMinutesLogged ?? 0,
        distinctSubjectsLogged: base?.distinctSubjectsLogged ?? 0,
        existingBadgeKeys: [],
        existingBadgeTitles: [],
      },
    };
  },
});

export const getFamilyOptimizeContext = query({
  args: { familyId: v.id("families") },
  returns: v.object({
    familyId: v.id("families"),
    familyName: v.string(),
    studentCount: v.number(),
    courseCount: v.number(),
    openChores: v.number(),
    totalLogs: v.number(),
    students: v.array(
      v.object({
        displayName: v.string(),
        academicLevel: v.optional(v.string()),
        level: v.number(),
        totalLogs: v.number(),
        currentStreak: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const family = await ctx.db.get("families", args.familyId);
    if (!family) throw new Error("Family not found");

    const students = await ctx.db
      .query("students")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    const chores = await ctx.db
      .query("chores")
      .withIndex("by_family_and_status", (q) =>
        q.eq("familyId", args.familyId).eq("status", "todo"),
      )
      .collect();

    let totalLogs = 0;
    const studentRows = [];
    for (const s of students) {
      const g = await ctx.db
        .query("studentGamification")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .unique();
      totalLogs += g?.totalLogs ?? 0;
      studentRows.push({
        displayName: s.displayName,
        academicLevel: s.academicLevel,
        level: g?.level ?? 1,
        totalLogs: g?.totalLogs ?? 0,
        currentStreak: g?.currentStreak ?? 0,
      });
    }

    return {
      familyId: family._id,
      familyName: family.name,
      studentCount: students.length,
      courseCount: courses.length,
      openChores: chores.length,
      totalLogs,
      students: studentRows,
    };
  },
});
