import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("superAdmin"),
  v.literal("parent"),
  v.literal("teacher"),
  v.literal("student"),
);

export const entryTypeValidator = v.union(
  v.literal("native_completion"),
  v.literal("external_time"),
  v.literal("manual"),
);

export const scheduleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("approved"),
);

export const subjectCategoryValidator = v.union(
  v.literal("stem"),
  v.literal("humanities"),
  v.literal("life"),
  v.literal("applied"),
);

export const userDocValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  role: v.optional(roleValidator),
  createdAt: v.optional(v.number()),
});

export const studentDocValidator = v.object({
  _id: v.id("students"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  userId: v.optional(v.id("users")),
  displayName: v.string(),
  birthYear: v.optional(v.number()),
  academicLevel: v.optional(v.string()),
  createdAt: v.number(),
});

export const logDocValidator = v.object({
  _id: v.id("logs"),
  _creationTime: v.number(),
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
});

export const scheduleDocValidator = v.object({
  _id: v.id("schedules"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  weekStart: v.string(),
  weekEnd: v.string(),
  status: scheduleStatusValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const subjectDocValidator = v.object({
  _id: v.id("subjects"),
  _creationTime: v.number(),
  name: v.string(),
  category: subjectCategoryValidator,
  createdAt: v.number(),
});

export const familyDocValidator = v.object({
  _id: v.id("families"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  createdAt: v.number(),
});

export const courseDocValidator = v.object({
  _id: v.id("courses"),
  _creationTime: v.number(),
  type: v.union(v.literal("native"), v.literal("external")),
  title: v.string(),
  description: v.optional(v.string()),
  subjectId: v.id("subjects"),
  ownerType: v.union(v.literal("family"), v.literal("academy")),
  familyId: v.optional(v.id("families")),
  academyId: v.optional(v.id("academies")),
  externalSourceName: v.optional(v.string()),
  createdAt: v.number(),
});
