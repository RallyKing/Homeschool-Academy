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
  imageStorageId: v.optional(v.id("_storage")),
  createdAt: v.number(),
  defaultPublicCheer: v.optional(v.boolean()),
  notifyKudos: v.optional(v.boolean()),
  notifyChores: v.optional(v.boolean()),
  notifyQuests: v.optional(v.boolean()),
});

export const logStatusValidator = v.union(
  v.literal("active"),
  v.literal("nullified"),
);

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
  status: v.optional(logStatusValidator),
  nullifiedAt: v.optional(v.number()),
  nullifiedBy: v.optional(v.id("users")),
  nullifyReason: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
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
  familyId: v.optional(v.id("families")),
});

export const familyDocValidator = v.object({
  _id: v.id("families"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  parentGuardrailContext: v.optional(v.string()),
  hiddenSubjectIds: v.optional(v.array(v.id("subjects"))),
  defaultPublicCheer: v.optional(v.boolean()),
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

export const alertTypeValidator = v.union(
  v.literal("schedule_revision_requested"),
  v.literal("log_created"),
  v.literal("log_verified"),
  v.literal("schedule_approved"),
  v.literal("schedule_item_added"),
  v.literal("course_assigned"),
  v.literal("assignment_new"),
  v.literal("chore_assigned"),
  v.literal("chore_completed"),
  v.literal("reward_redeemed"),
  v.literal("accolade_awarded"),
  v.literal("kudos_received"),
  v.literal("feed_comment"),
  v.literal("feed_reaction"),
  v.literal("feed_recheer"),
  v.literal("general"),
);

export const alertRecipientTypeValidator = v.union(
  v.literal("user"),
  v.literal("family"),
  v.literal("student"),
);

export const alertDocValidator = v.object({
  _id: v.id("alerts"),
  _creationTime: v.number(),
  recipientType: alertRecipientTypeValidator,
  recipientUserId: v.optional(v.id("users")),
  familyId: v.optional(v.id("families")),
  studentId: v.optional(v.id("students")),
  type: alertTypeValidator,
  title: v.string(),
  body: v.string(),
  href: v.optional(v.string()),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
  createdBy: v.optional(v.id("users")),
  sourceTable: v.optional(v.string()),
  sourceId: v.optional(v.string()),
});

export const publishStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
);

export const productUpdateDocValidator = v.object({
  _id: v.id("productUpdates"),
  _creationTime: v.number(),
  title: v.string(),
  summary: v.string(),
  body: v.string(),
  version: v.optional(v.string()),
  status: publishStatusValidator,
  knowledgeBaseArticleId: v.optional(v.id("knowledgeBaseArticles")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  publishedAt: v.optional(v.number()),
});

export const knowledgeBaseArticleDocValidator = v.object({
  _id: v.id("knowledgeBaseArticles"),
  _creationTime: v.number(),
  title: v.string(),
  slug: v.string(),
  body: v.string(),
  category: v.optional(v.string()),
  productUpdateId: v.optional(v.id("productUpdates")),
  status: publishStatusValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});
