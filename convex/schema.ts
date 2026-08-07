import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const roleValidator = v.union(
  v.literal("superAdmin"),
  v.literal("parent"),
  v.literal("teacher"),
  v.literal("student"),
);

const subjectCategoryValidator = v.union(
  v.literal("stem"),
  v.literal("humanities"),
  v.literal("life"),
  v.literal("applied"),
);

const courseTypeValidator = v.union(
  v.literal("native"),
  v.literal("external"),
);

const ownerTypeValidator = v.union(
  v.literal("family"),
  v.literal("academy"),
);

const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending"),
  v.literal("cancelled"),
);

const scheduleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("approved"),
);

const entryTypeValidator = v.union(
  v.literal("native_completion"),
  v.literal("external_time"),
  v.literal("manual"),
);

const familyMemberRoleValidator = v.union(
  v.literal("parent"),
  v.literal("guardian"),
);

const academyMemberRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("admin"),
);

export default defineSchema({
  ...authTables,

  // Extend Convex Auth users with app role + profile fields
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    createdAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("by_role", ["role"]),

  families: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_name", ["name"]),

  familyMembers: defineTable({
    familyId: v.id("families"),
    userId: v.id("users"),
    role: familyMemberRoleValidator,
    createdAt: v.number(),
  })
    .index("by_family", ["familyId"])
    .index("by_user", ["userId"])
    .index("by_family_and_user", ["familyId", "userId"]),

  academies: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    description: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_name", ["name"]),

  academyMembers: defineTable({
    academyId: v.id("academies"),
    userId: v.id("users"),
    role: academyMemberRoleValidator,
    createdAt: v.number(),
  })
    .index("by_academy", ["academyId"])
    .index("by_user", ["userId"])
    .index("by_academy_and_user", ["academyId", "userId"]),

  students: defineTable({
    familyId: v.id("families"),
    userId: v.optional(v.id("users")),
    displayName: v.string(),
    birthYear: v.optional(v.number()),
    academicLevel: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_family", ["familyId"])
    .index("by_user", ["userId"])
    .index("by_family_and_name", ["familyId", "displayName"]),

  familyAcademySubscriptions: defineTable({
    familyId: v.id("families"),
    academyId: v.id("academies"),
    status: subscriptionStatusValidator,
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_family", ["familyId"])
    .index("by_academy", ["academyId"])
    .index("by_family_and_academy", ["familyId", "academyId"])
    .index("by_status", ["status"]),

  subjects: defineTable({
    name: v.string(),
    category: subjectCategoryValidator,
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_name", ["name"]),

  courses: defineTable({
    type: courseTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    subjectId: v.id("subjects"),
    ownerType: ownerTypeValidator,
    familyId: v.optional(v.id("families")),
    academyId: v.optional(v.id("academies")),
    externalSourceName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_subject", ["subjectId"])
    .index("by_family", ["familyId"])
    .index("by_academy", ["academyId"])
    .index("by_ownerType", ["ownerType"])
    .index("by_type", ["type"]),

  modules: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_course_and_order", ["courseId", "order"]),

  lessons: defineTable({
    moduleId: v.id("modules"),
    title: v.string(),
    order: v.number(),
    estimatedMinutes: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_module", ["moduleId"])
    .index("by_module_and_order", ["moduleId", "order"]),

  schedules: defineTable({
    studentId: v.id("students"),
    weekStart: v.string(), // ISO date YYYY-MM-DD
    weekEnd: v.string(),
    status: scheduleStatusValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_student", ["studentId"])
    .index("by_student_and_status", ["studentId", "status"])
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"]),

  scheduleItems: defineTable({
    scheduleId: v.id("schedules"),
    courseId: v.optional(v.id("courses")),
    title: v.string(),
    plannedMinutes: v.number(),
    dayOfWeek: v.optional(v.number()), // 0–6
    date: v.optional(v.string()), // ISO date
    createdAt: v.number(),
  })
    .index("by_schedule", ["scheduleId"])
    .index("by_course", ["courseId"]),

  logs: defineTable({
    studentId: v.id("students"),
    courseId: v.optional(v.id("courses")),
    subjectId: v.optional(v.id("subjects")),
    entryType: entryTypeValidator,
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    verifiedByParent: v.boolean(),
    verifiedBy: v.optional(v.id("users")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_student_and_createdAt", ["studentId", "createdAt"])
    .index("by_course", ["courseId"])
    .index("by_subject", ["subjectId"])
    .index("by_createdBy", ["createdBy"]),
});
