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
  mainParentUserId: v.optional(v.id("users")),
  parentGuardrailContext: v.optional(v.string()),
  hiddenSubjectIds: v.optional(v.array(v.id("subjects"))),
  defaultPublicCheer: v.optional(v.boolean()),
});

export const schoolRoleValidator = v.union(
  v.literal("main"),
  v.literal("admin"),
  v.literal("regular"),
);

export const staffKindValidator = v.union(
  v.literal("teacher"),
  v.literal("tutor"),
);

export const contactKindValidator = v.union(
  v.literal("school"),
  v.literal("parent"),
  v.literal("teacher"),
  v.literal("tutor"),
  v.literal("student"),
  v.literal("user"),
);

export const contactDocValidator = v.object({
  _id: v.id("contacts"),
  _creationTime: v.number(),
  kind: contactKindValidator,
  familyId: v.optional(v.id("families")),
  userId: v.optional(v.id("users")),
  studentId: v.optional(v.id("students")),
  academyId: v.optional(v.id("academies")),
  displayName: v.string(),
  emails: v.array(v.string()),
  phones: v.array(v.string()),
  notes: v.optional(v.string()),
  roleLabel: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
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

export const readAlongAgeBandValidator = v.union(
  v.literal("early_elementary"),
  v.literal("elementary"),
  v.literal("middle"),
  v.literal("teen"),
  v.literal("mixed"),
);

export const readAlongSessionStatusValidator = v.union(
  v.literal("in_progress"),
  v.literal("practice"),
  v.literal("completed"),
);

export const readAlongWordResultValidator = v.union(
  v.literal("correct"),
  v.literal("retry_ok"),
  v.literal("helped"),
);

export const readAlongLengthValidator = v.union(
  v.literal("short"),
  v.literal("medium"),
  v.literal("long"),
);

export const readAlongRecipeDocValidator = v.object({
  _id: v.id("readAlongRecipes"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  title: v.string(),
  gradeLevel: v.string(),
  theme: v.string(),
  moralLessons: v.array(v.string()),
  length: readAlongLengthValidator,
  aiPrompt: v.string(),
  active: v.boolean(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const readAlongStoryDocValidator = v.object({
  _id: v.id("readAlongStories"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  studentId: v.optional(v.id("students")),
  title: v.string(),
  body: v.string(),
  words: v.array(v.string()),
  wordCount: v.number(),
  ageBand: v.optional(readAlongAgeBandValidator),
  subject: v.optional(v.string()),
  recipeId: v.optional(v.id("readAlongRecipes")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const readAlongSessionDocValidator = v.object({
  _id: v.id("readAlongSessions"),
  _creationTime: v.number(),
  storyId: v.id("readAlongStories"),
  studentId: v.id("students"),
  familyId: v.id("families"),
  status: readAlongSessionStatusValidator,
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  currentWordIndex: v.number(),
  wordsCorrect: v.number(),
  wordsMissed: v.number(),
  pointsAwarded: v.number(),
  needsHelpWords: v.array(v.string()),
  practicedWords: v.optional(v.array(v.string())),
  logId: v.optional(v.id("logs")),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const readAlongWordEventDocValidator = v.object({
  _id: v.id("readAlongWordEvents"),
  _creationTime: v.number(),
  sessionId: v.id("readAlongSessions"),
  wordIndex: v.number(),
  word: v.string(),
  result: readAlongWordResultValidator,
  createdAt: v.number(),
});

export const dictionarySourceValidator = v.union(
  v.literal("merriam-webster"),
  v.literal("dictionaryapi.dev"),
  v.literal("manual"),
);

export const dictionaryEntryDocValidator = v.object({
  _id: v.id("dictionaryEntries"),
  _creationTime: v.number(),
  word: v.string(),
  definition: v.string(),
  partOfSpeech: v.optional(v.string()),
  example: v.optional(v.string()),
  source: dictionarySourceValidator,
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const speechReporterRoleValidator = v.union(
  v.literal("superAdmin"),
  v.literal("family_main"),
  v.literal("family_admin"),
  v.literal("parent"),
  v.literal("teacher"),
  v.literal("tutor"),
);

export const speechReportStatusValidator = v.union(
  v.literal("open"),
  v.literal("testing"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("ticketed"),
);

export const speechTicketStatusValidator = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("resolved"),
);

export const speechRecognitionSampleValidator = v.object({
  transcript: v.string(),
  at: v.number(),
});

export const speechWordReportDocValidator = v.object({
  _id: v.id("speechWordReports"),
  _creationTime: v.number(),
  word: v.string(),
  normalizedWord: v.string(),
  reportedByUserId: v.id("users"),
  reporterRole: speechReporterRoleValidator,
  studentId: v.optional(v.id("students")),
  sessionId: v.optional(v.id("readAlongSessions")),
  storyId: v.optional(v.id("readAlongStories")),
  familyId: v.optional(v.id("families")),
  status: speechReportStatusValidator,
  recognitionSamples: v.optional(v.array(speechRecognitionSampleValidator)),
  notes: v.optional(v.string()),
  ticketId: v.optional(v.id("speechDevTickets")),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

export const speechDevTicketDocValidator = v.object({
  _id: v.id("speechDevTickets"),
  _creationTime: v.number(),
  title: v.string(),
  body: v.string(),
  sourceReportId: v.optional(v.id("speechWordReports")),
  status: speechTicketStatusValidator,
  createdByAdminId: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});
