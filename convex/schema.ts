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
    imageStorageId: v.optional(v.id("_storage")),
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
    /** Missing status is treated as active (legacy docs). */
    status: v.optional(
      v.union(v.literal("active"), v.literal("nullified")),
    ),
    nullifiedAt: v.optional(v.number()),
    nullifiedBy: v.optional(v.id("users")),
    nullifyReason: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_student", ["studentId"])
    .index("by_student_and_createdAt", ["studentId", "createdAt"])
    .index("by_course", ["courseId"])
    .index("by_subject", ["subjectId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_student_and_status", ["studentId", "status"]),

  alerts: defineTable({
    recipientType: v.union(
      v.literal("user"),
      v.literal("family"),
      v.literal("student"),
    ),
    recipientUserId: v.optional(v.id("users")),
    familyId: v.optional(v.id("families")),
    studentId: v.optional(v.id("students")),
    type: v.union(
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
      v.literal("general"),
    ),
    title: v.string(),
    body: v.string(),
    href: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
    sourceTable: v.optional(v.string()),
    sourceId: v.optional(v.string()),
  })
    .index("by_user", ["recipientUserId"])
    .index("by_family", ["familyId"])
    .index("by_student", ["studentId"])
    .index("by_user_and_createdAt", ["recipientUserId", "createdAt"])
    .index("by_family_and_createdAt", ["familyId", "createdAt"])
    .index("by_student_and_createdAt", ["studentId", "createdAt"]),

  productUpdates: defineTable({
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    version: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    knowledgeBaseArticleId: v.optional(v.id("knowledgeBaseArticles")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_publishedAt", ["publishedAt"])
    .index("by_createdBy", ["createdBy"]),

  knowledgeBaseArticles: defineTable({
    title: v.string(),
    slug: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    productUpdateId: v.optional(v.id("productUpdates")),
    status: v.union(v.literal("draft"), v.literal("published")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_productUpdate", ["productUpdateId"]),

  // ── Gamification ──────────────────────────────────────────────
  // XP = permanent progression. Points = spendable currency. Stars = prestige.
  studentGamification: defineTable({
    studentId: v.id("students"),
    familyId: v.id("families"),
    xp: v.number(),
    level: v.number(),
    points: v.number(),
    stars: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletionDate: v.optional(v.string()), // YYYY-MM-DD
    streakFreezes: v.number(),
    weeklyXp: v.number(),
    weeklyPoints: v.number(),
    weeklyStars: v.number(),
    weekStart: v.optional(v.string()), // YYYY-MM-DD Sunday of tracked week
    totalLogs: v.number(),
    totalChoresCompleted: v.number(),
    totalMinutesLogged: v.number(),
    distinctSubjectsLogged: v.number(),
    updatedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_family", ["familyId"])
    .index("by_family_and_xp", ["familyId", "xp"]),

  badges: defineTable({
    key: v.string(),
    title: v.string(),
    description: v.string(),
    iconKey: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    pointsReward: v.optional(v.number()),
    criteriaType: v.union(
      v.literal("logs_count"),
      v.literal("streak"),
      v.literal("stars"),
      v.literal("chores_completed"),
      v.literal("minutes_logged"),
      v.literal("subjects_explored"),
      v.literal("level"),
      v.literal("manual"),
    ),
    criteriaValue: v.optional(v.number()),
    /** Family-scoped custom / AI-crafted badges; omitted for system catalog. */
    familyId: v.optional(v.id("families")),
    ageBand: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("system"), v.literal("ai"), v.literal("manual")),
    ),
    criteriaSummary: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_criteriaType", ["criteriaType"])
    .index("by_family", ["familyId"])
    .index("by_family_and_source", ["familyId", "source"]),

  studentBadges: defineTable({
    studentId: v.id("students"),
    badgeId: v.id("badges"),
    earnedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_badge", ["badgeId"])
    .index("by_student_and_badge", ["studentId", "badgeId"]),

  /** AI-proposed badges awaiting parent accept/reject (safety gate). */
  badgeProposals: defineTable({
    familyId: v.id("families"),
    studentId: v.id("students"),
    key: v.string(),
    title: v.string(),
    description: v.string(),
    iconHint: v.string(),
    criteriaSummary: v.string(),
    ageBand: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    acceptedBadgeId: v.optional(v.id("badges")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_family", ["familyId"])
    .index("by_student", ["studentId"])
    .index("by_family_and_status", ["familyId", "status"])
    .index("by_student_and_status", ["studentId", "status"]),

  accolades: defineTable({
    studentId: v.id("students"),
    familyId: v.id("families"),
    title: v.string(),
    message: v.optional(v.string()),
    awardedBy: v.id("users"),
    bonusStars: v.optional(v.number()),
    bonusPoints: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_family", ["familyId"]),

  rewardCatalog: defineTable({
    familyId: v.id("families"),
    title: v.string(),
    description: v.optional(v.string()),
    costPoints: v.number(),
    active: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_family", ["familyId"])
    .index("by_family_and_active", ["familyId", "active"]),

  rewardRedemptions: defineTable({
    familyId: v.id("families"),
    studentId: v.id("students"),
    rewardId: v.id("rewardCatalog"),
    costPoints: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("fulfilled"),
      v.literal("cancelled"),
    ),
    redeemedAt: v.number(),
    fulfilledAt: v.optional(v.number()),
    fulfilledBy: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  })
    .index("by_family", ["familyId"])
    .index("by_student", ["studentId"])
    .index("by_reward", ["rewardId"])
    .index("by_family_and_status", ["familyId", "status"])
    .index("by_student_and_status", ["studentId", "status"]),

  dailyQuests: defineTable({
    studentId: v.id("students"),
    familyId: v.id("families"),
    date: v.string(), // YYYY-MM-DD
    questKey: v.string(),
    title: v.string(),
    description: v.string(),
    targetValue: v.number(),
    currentValue: v.number(),
    completed: v.boolean(),
    xpReward: v.number(),
    pointsReward: v.number(),
    claimedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_student_and_date", ["studentId", "date"])
    .index("by_student", ["studentId"])
    .index("by_family_and_date", ["familyId", "date"]),

  /**
   * Per-source award ledger so nullify/delete/restore can reverse or re-apply
   * XP/points/stars without double-counting. Streak side-effects are not stored.
   */
  gamificationAwards: defineTable({
    studentId: v.id("students"),
    familyId: v.id("families"),
    sourceType: v.union(
      v.literal("log"),
      v.literal("chore"),
      v.literal("accolade"),
      v.literal("quest"),
      v.literal("badge"),
      v.literal("bonus"),
      v.literal("social"),
    ),
    sourceId: v.string(),
    xp: v.number(),
    points: v.number(),
    stars: v.number(),
    logIncrement: v.optional(v.number()),
    choreIncrement: v.optional(v.number()),
    minutesIncrement: v.optional(v.number()),
    newSubject: v.optional(v.boolean()),
    awardDate: v.optional(v.string()), // YYYY-MM-DD when awarded
    weekStart: v.optional(v.string()),
    createdAt: v.number(),
    reversedAt: v.optional(v.number()),
  })
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_student", ["studentId"])
    .index("by_student_and_source", ["studentId", "sourceType", "sourceId"]),

  // ── Chores ────────────────────────────────────────────────────
  chores: defineTable({
    familyId: v.id("families"),
    studentId: v.id("students"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    recurrence: v.union(
      v.literal("once"),
      v.literal("daily"),
      v.literal("weekly"),
    ),
    status: v.union(
      v.literal("todo"),
      v.literal("done"),
      v.literal("skipped"),
    ),
    xpReward: v.optional(v.number()),
    pointsReward: v.optional(v.number()),
    starsReward: v.optional(v.number()),
    assignedBy: v.id("users"),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_family", ["familyId"])
    .index("by_student", ["studentId"])
    .index("by_student_and_status", ["studentId", "status"])
    .index("by_family_and_status", ["familyId", "status"]),

  // ── Encouragement Circle (student social — non-competitive) ──
  socialThreads: defineTable({
    familyId: v.id("families"),
    participantStudentIds: v.array(v.id("students")),
    participantKey: v.string(),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_family", ["familyId"])
    .index("by_participantKey", ["participantKey"])
    .index("by_family_and_updatedAt", ["familyId", "updatedAt"]),

  socialMessages: defineTable({
    threadId: v.id("socialThreads"),
    familyId: v.id("families"),
    fromStudentId: v.id("students"),
    toStudentId: v.id("students"),
    kind: v.union(
      v.literal("encourage"),
      v.literal("motivate"),
      v.literal("congratulate"),
      v.literal("sticker"),
    ),
    body: v.optional(v.string()),
    stickerKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_createdAt", ["threadId", "createdAt"])
    .index("by_family", ["familyId"])
    .index("by_family_and_createdAt", ["familyId", "createdAt"])
    .index("by_from", ["fromStudentId"])
    .index("by_to", ["toStudentId"])
    .index("by_to_and_createdAt", ["toStudentId", "createdAt"]),

  stickerPacks: defineTable({
    packKey: v.string(),
    title: v.string(),
    description: v.string(),
    sortOrder: v.number(),
    free: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_packKey", ["packKey"])
    .index("by_sortOrder", ["sortOrder"]),

  stickers: defineTable({
    packId: v.id("stickerPacks"),
    stickerKey: v.string(),
    label: v.string(),
    emoji: v.string(),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_pack", ["packId"])
    .index("by_stickerKey", ["stickerKey"]),

  studentSocialStats: defineTable({
    studentId: v.id("students"),
    familyId: v.id("families"),
    kindnessGiven: v.number(),
    kindnessReceived: v.number(),
    stickersSent: v.number(),
    stickersReceived: v.number(),
    updatedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_family", ["familyId"]),

  studentUnlocks: defineTable({
    studentId: v.id("students"),
    unlockKey: v.string(),
    unlockedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_student_and_key", ["studentId", "unlockKey"])
    .index("by_unlockKey", ["unlockKey"]),

  studentCustomization: defineTable({
    studentId: v.id("students"),
    themeKey: v.string(),
    frameKey: v.string(),
    bubbleKey: v.string(),
    unlockedPackIds: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_student", ["studentId"]),
});
