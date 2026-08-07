import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { alertStudent } from "./lib/alerts";
import {
  requireFamilyAccess,
  getCurrentUser,
  getFamilyMembership,
  requireStudentFamilyAccess,
} from "./lib/auth";
import { createFeedPost } from "./lib/feed";
import { awardProgress } from "./lib/gamificationCore";
import {
  BUBBLE_OPTIONS,
  DEFAULT_BUBBLE,
  DEFAULT_FRAME,
  DEFAULT_THEME,
  FRAME_OPTIONS,
  KINDNESS_POINTS,
  KINDNESS_XP,
  MESSAGE_PRESETS,
  STARTER_PACK,
  STICKER_POINTS,
  STICKER_XP,
  THEME_OPTIONS,
  UNLOCK_DEFS,
  assertPackUnlocked,
  evaluateUnlocks,
  findStickerByKey,
  getOrCreateCustomization,
  getOrCreateSocialStats,
  normalizeBody,
  participantKey,
  seedStickerCatalog,
  type MessageKind,
} from "./lib/socialCore";

const messageKindValidator = v.union(
  v.literal("encourage"),
  v.literal("motivate"),
  v.literal("congratulate"),
  v.literal("sticker"),
);

const socialMessageDocValidator = v.object({
  _id: v.id("socialMessages"),
  _creationTime: v.number(),
  threadId: v.id("socialThreads"),
  familyId: v.id("families"),
  fromStudentId: v.id("students"),
  toStudentId: v.id("students"),
  kind: messageKindValidator,
  body: v.optional(v.string()),
  stickerKey: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),
  deletedBy: v.optional(v.id("users")),
});

const socialThreadDocValidator = v.object({
  _id: v.id("socialThreads"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  participantStudentIds: v.array(v.id("students")),
  participantKey: v.string(),
  updatedAt: v.number(),
  createdAt: v.number(),
});

const customizationDocValidator = v.object({
  _id: v.id("studentCustomization"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  themeKey: v.string(),
  frameKey: v.string(),
  bubbleKey: v.string(),
  unlockedPackIds: v.array(v.string()),
  updatedAt: v.number(),
});

const socialStatsDocValidator = v.object({
  _id: v.id("studentSocialStats"),
  _creationTime: v.number(),
  studentId: v.id("students"),
  familyId: v.id("families"),
  kindnessGiven: v.number(),
  kindnessReceived: v.number(),
  stickersSent: v.number(),
  stickersReceived: v.number(),
  updatedAt: v.number(),
});

async function assertActorIsStudent(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<"students">,
): Promise<{ user: Doc<"users">; student: Doc<"students"> }> {
  const { user, student } = await requireStudentFamilyAccess(ctx, studentId);
  if (student.userId === user._id) {
    return { user, student };
  }
  if (user.role === "superAdmin") {
    return { user, student };
  }
  const role = user.role ?? "parent";
  if (role === "parent") {
    const membership = await getFamilyMembership(
      ctx,
      student.familyId,
      user._id,
    );
    if (membership) {
      return { user, student };
    }
  }
  throw new Error("Unauthorized: only the student (or their parent) can do this");
}

async function getOrCreateThreadDoc(
  ctx: MutationCtx,
  familyId: Id<"families">,
  a: Id<"students">,
  b: Id<"students">,
): Promise<Doc<"socialThreads">> {
  const key = participantKey(a, b);
  const existing = await ctx.db
    .query("socialThreads")
    .withIndex("by_participantKey", (q) => q.eq("participantKey", key))
    .unique();
  if (existing) return existing;

  const now = Date.now();
  const ids = [a, b].sort() as Id<"students">[];
  const id = await ctx.db.insert("socialThreads", {
    familyId,
    participantStudentIds: ids,
    participantKey: key,
    updatedAt: now,
    createdAt: now,
  });
  const doc = await ctx.db.get("socialThreads", id);
  if (!doc) throw new Error("Failed to create thread");
  return doc;
}

function kindLabel(kind: MessageKind): string {
  switch (kind) {
    case "encourage":
      return "encouragement";
    case "motivate":
      return "motivation";
    case "congratulate":
      return "congrats";
    case "sticker":
      return "a sticker";
  }
}

function allowedCustomizationKeys(earnedKeys: Set<string>): {
  themes: Set<string>;
  frames: Set<string>;
  bubbles: Set<string>;
} {
  const themes = new Set<string>([DEFAULT_THEME]);
  const frames = new Set<string>([DEFAULT_FRAME]);
  const bubbles = new Set<string>([DEFAULT_BUBBLE]);
  for (const def of UNLOCK_DEFS) {
    if (!earnedKeys.has(def.unlockKey) || !def.appliesTo) continue;
    if (def.category === "theme") themes.add(def.appliesTo);
    if (def.category === "frame") frames.add(def.appliesTo);
    if (def.category === "bubble") bubbles.add(def.appliesTo);
  }
  return { themes, frames, bubbles };
}

export const seedCatalog = mutation({
  args: {},
  returns: v.object({ packs: v.number(), stickers: v.number() }),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await seedStickerCatalog(ctx);
  },
});

export const listSiblings = query({
  args: { studentId: v.id("students") },
  returns: v.array(
    v.object({
      _id: v.id("students"),
      displayName: v.string(),
      imageStorageId: v.optional(v.id("_storage")),
      academicLevel: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const siblings = await ctx.db
      .query("students")
      .withIndex("by_family", (q) => q.eq("familyId", student.familyId))
      .collect();
    return siblings
      .filter((s) => s._id !== student._id)
      .map((s) => ({
        _id: s._id,
        displayName: s.displayName,
        imageStorageId: s.imageStorageId,
        academicLevel: s.academicLevel,
      }));
  },
});

export const listThreads = query({
  args: { studentId: v.id("students") },
  returns: v.array(
    v.object({
      thread: socialThreadDocValidator,
      peer: v.object({
        _id: v.id("students"),
        displayName: v.string(),
        imageStorageId: v.optional(v.id("_storage")),
      }),
      lastMessage: v.union(
        v.object({
          kind: messageKindValidator,
          body: v.optional(v.string()),
          stickerKey: v.optional(v.string()),
          createdAt: v.number(),
          fromStudentId: v.id("students"),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const threads = await ctx.db
      .query("socialThreads")
      .withIndex("by_family", (q) => q.eq("familyId", student.familyId))
      .collect();

    const mine = threads.filter((t) =>
      t.participantStudentIds.includes(args.studentId),
    );

    const out = [];
    for (const thread of mine) {
      const peerId = thread.participantStudentIds.find(
        (id) => id !== args.studentId,
      );
      if (!peerId) continue;
      const peer = await ctx.db.get("students", peerId);
      if (!peer) continue;

      const messages = await ctx.db
        .query("socialMessages")
        .withIndex("by_thread_and_createdAt", (q) =>
          q.eq("threadId", thread._id),
        )
        .order("desc")
        .take(8);

      const lastVisible = messages.find((m) => m.deletedAt === undefined);
      out.push({
        thread,
        peer: {
          _id: peer._id,
          displayName: peer.displayName,
          imageStorageId: peer.imageStorageId,
        },
        lastMessage: lastVisible
          ? {
              kind: lastVisible.kind,
              body: lastVisible.body,
              stickerKey: lastVisible.stickerKey,
              createdAt: lastVisible.createdAt,
              fromStudentId: lastVisible.fromStudentId,
            }
          : null,
      });
    }

    return out.sort((a, b) => b.thread.updatedAt - a.thread.updatedAt);
  },
});

export const listMessages = query({
  args: {
    studentId: v.id("students"),
    threadId: v.id("socialThreads"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      message: socialMessageDocValidator,
      fromName: v.string(),
      stickerEmoji: v.optional(v.string()),
      stickerLabel: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const thread = await ctx.db.get("socialThreads", args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (!thread.participantStudentIds.includes(args.studentId)) {
      throw new Error("Unauthorized: not a participant in this thread");
    }

    const limit = Math.min(args.limit ?? 80, 120);
    const messages = await ctx.db
      .query("socialMessages")
      .withIndex("by_thread_and_createdAt", (q) =>
        q.eq("threadId", args.threadId),
      )
      .order("desc")
      .take(limit);

    const visible = messages.filter((m) => m.deletedAt === undefined).reverse();
    const out = [];
    for (const message of visible) {
      const from = await ctx.db.get("students", message.fromStudentId);
      let stickerEmoji: string | undefined;
      let stickerLabel: string | undefined;
      if (message.stickerKey) {
        const sticker = await findStickerByKey(ctx, message.stickerKey);
        stickerEmoji = sticker?.emoji;
        stickerLabel = sticker?.label;
      }
      out.push({
        message,
        fromName: from?.displayName ?? "Student",
        stickerEmoji,
        stickerLabel,
      });
    }
    return out;
  },
});

export const sendKudos = mutation({
  args: {
    fromStudentId: v.id("students"),
    toStudentId: v.id("students"),
    kind: messageKindValidator,
    body: v.optional(v.string()),
    stickerKey: v.optional(v.string()),
    /** Celebrate on the family wall. Defaults true for stickers & encourage. */
    publicToFeed: v.optional(v.boolean()),
    today: v.string(),
    weekStart: v.optional(v.string()),
  },
  returns: v.object({
    messageId: v.id("socialMessages"),
    threadId: v.id("socialThreads"),
    newUnlocks: v.array(v.string()),
    xpGained: v.number(),
    pointsGained: v.number(),
    feedPostId: v.union(v.id("feedPosts"), v.null()),
  }),
  handler: async (ctx, args) => {
    const { user, student: from } = await assertActorIsStudent(
      ctx,
      args.fromStudentId,
    );

    if (args.fromStudentId === args.toStudentId) {
      throw new Error("Send cheers to a sibling — not yourself");
    }

    const to = await ctx.db.get("students", args.toStudentId);
    if (!to) throw new Error("Recipient not found");
    if (to.familyId !== from.familyId) {
      throw new Error("You can only cheer siblings in your family");
    }

    const kind = args.kind;
    const body = normalizeBody(args.body);
    const stickerKey = args.stickerKey?.trim() || undefined;

    if (kind === "sticker") {
      if (!stickerKey) throw new Error("Pick a sticker to send");
    }
    if (stickerKey) {
      const sticker = await findStickerByKey(ctx, stickerKey);
      if (!sticker) {
        throw new Error("Sticker not found — open Cheer and seed stickers first");
      }
      const pack = await ctx.db.get("stickerPacks", sticker.packId);
      if (!pack) throw new Error("Sticker pack missing");
      await assertPackUnlocked(ctx, args.fromStudentId, pack.packKey);
    }

    if (kind !== "sticker" && !body && !stickerKey) {
      throw new Error("Write a short note or add a sticker");
    }

    const thread = await getOrCreateThreadDoc(
      ctx,
      from.familyId,
      args.fromStudentId,
      args.toStudentId,
    );

    const now = Date.now();
    const messageId = await ctx.db.insert("socialMessages", {
      threadId: thread._id,
      familyId: from.familyId,
      fromStudentId: args.fromStudentId,
      toStudentId: args.toStudentId,
      kind,
      body,
      stickerKey,
      createdAt: now,
    });

    await ctx.db.patch("socialThreads", thread._id, { updatedAt: now });

    const fromStats = await getOrCreateSocialStats(
      ctx,
      args.fromStudentId,
      from.familyId,
    );
    const toStats = await getOrCreateSocialStats(
      ctx,
      args.toStudentId,
      to.familyId,
    );

    const isStickerOnly = kind === "sticker" && !body;
    const kindnessDelta = isStickerOnly ? 0 : 1;

    await ctx.db.patch("studentSocialStats", fromStats._id, {
      kindnessGiven: fromStats.kindnessGiven + kindnessDelta,
      stickersSent: fromStats.stickersSent + (stickerKey ? 1 : 0),
      updatedAt: now,
    });
    await ctx.db.patch("studentSocialStats", toStats._id, {
      kindnessReceived: toStats.kindnessReceived + kindnessDelta,
      stickersReceived: toStats.stickersReceived + (stickerKey ? 1 : 0),
      updatedAt: now,
    });

    await getOrCreateCustomization(ctx, args.fromStudentId);
    await getOrCreateCustomization(ctx, args.toStudentId);

    const xp = isStickerOnly ? STICKER_XP : KINDNESS_XP;
    const points = isStickerOnly ? STICKER_POINTS : KINDNESS_POINTS;

    const award = await awardProgress(ctx, {
      studentId: args.fromStudentId,
      familyId: from.familyId,
      today: args.today,
      weekStart: args.weekStart,
      xp,
      points,
      stars: 0,
      source: "social",
      skipStreak: true,
      skipQuests: true,
    });

    const newUnlocks = await evaluateUnlocks(ctx, args.fromStudentId);
    await evaluateUnlocks(ctx, args.toStudentId);

    const preview = body ?? (stickerKey ? "sent a sticker" : kindLabel(kind));
    await alertStudent(ctx, {
      studentId: args.toStudentId,
      type: "kudos_received",
      title: `${from.displayName} sent you ${kindLabel(kind)}`,
      body: preview.slice(0, 160),
      href: "/student/social",
      createdBy: user._id,
      sourceTable: "socialMessages",
      sourceId: messageId,
    });

    const family = await ctx.db.get("families", from.familyId);
    const prefDefault =
      from.defaultPublicCheer ??
      family?.defaultPublicCheer ??
      (kind === "sticker" || kind === "encourage" || kind === "congratulate");
    const publicToFeed = args.publicToFeed ?? prefDefault;
    let feedPostId: Id<"feedPosts"> | null = null;
    if (publicToFeed) {
      const isStickerPost = Boolean(stickerKey) && (kind === "sticker" || !body);
      feedPostId = await createFeedPost(ctx, {
        familyId: from.familyId,
        type: isStickerPost ? "sticker" : "kudos",
        actorStudentId: args.fromStudentId,
        targetStudentId: args.toStudentId,
        title: isStickerPost
          ? `${from.displayName} sent ${to.displayName} a sticker`
          : `${from.displayName} cheered ${to.displayName}`,
        body: body ?? (stickerKey ? undefined : `Shared ${kindLabel(kind)}`),
        stickerKey,
        href: "/student/social?tab=wall",
        sourceTable: "socialMessages",
        sourceId: messageId,
        createdByUserId: user._id,
      });
    }

    return {
      messageId,
      threadId: thread._id,
      newUnlocks,
      xpGained: award.xpGained,
      pointsGained: award.pointsGained,
      feedPostId,
    };
  },
});

export const updateMessage = mutation({
  args: {
    studentId: v.id("students"),
    messageId: v.id("socialMessages"),
    body: v.string(),
  },
  returns: socialMessageDocValidator,
  handler: async (ctx, args) => {
    await assertActorIsStudent(ctx, args.studentId);
    const message = await ctx.db.get("socialMessages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.deletedAt) throw new Error("Message was removed");
    if (message.fromStudentId !== args.studentId) {
      throw new Error("You can only edit your own messages");
    }
    const body = normalizeBody(args.body);
    if (!body) throw new Error("Message cannot be empty");

    await ctx.db.patch("socialMessages", args.messageId, {
      body,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("socialMessages", args.messageId);
    if (!updated) throw new Error("Failed to update message");
    return updated;
  },
});

export const softDeleteMessage = mutation({
  args: {
    studentId: v.id("students"),
    messageId: v.id("socialMessages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await assertActorIsStudent(ctx, args.studentId);
    const message = await ctx.db.get("socialMessages", args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.deletedAt) return null;
    if (message.fromStudentId !== args.studentId) {
      throw new Error("You can only remove your own messages");
    }
    await ctx.db.patch("socialMessages", args.messageId, {
      deletedAt: Date.now(),
      deletedBy: user._id,
    });
    return null;
  },
});

export const moderateDeleteMessage = mutation({
  args: {
    messageId: v.id("socialMessages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("socialMessages", args.messageId);
    if (!message) throw new Error("Message not found");
    // Parent of either party (same family) may moderate cheers on a student profile.
    const { user } = await requireFamilyAccess(ctx, message.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can moderate cheers");
    }
    if (message.deletedAt) return null;
    await ctx.db.patch("socialMessages", args.messageId, {
      deletedAt: Date.now(),
      deletedBy: user._id,
    });
    return null;
  },
});

export const listCatalog = query({
  args: { studentId: v.id("students") },
  returns: v.array(
    v.object({
      packKey: v.string(),
      title: v.string(),
      description: v.string(),
      free: v.boolean(),
      unlocked: v.boolean(),
      stickers: v.array(
        v.object({
          stickerKey: v.string(),
          label: v.string(),
          emoji: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const packs = await ctx.db.query("stickerPacks").collect();
    packs.sort((a, b) => a.sortOrder - b.sortOrder);

    const customization = await ctx.db
      .query("studentCustomization")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .unique();
    const unlocked = new Set(
      customization?.unlockedPackIds ?? [STARTER_PACK],
    );

    const out = [];
    for (const pack of packs) {
      const stickers = await ctx.db
        .query("stickers")
        .withIndex("by_pack", (q) => q.eq("packId", pack._id))
        .collect();
      stickers.sort((a, b) => a.sortOrder - b.sortOrder);
      out.push({
        packKey: pack.packKey,
        title: pack.title,
        description: pack.description,
        free: pack.free,
        unlocked: pack.free || unlocked.has(pack.packKey),
        stickers: stickers.map((s) => ({
          stickerKey: s.stickerKey,
          label: s.label,
          emoji: s.emoji,
        })),
      });
    }
    return out;
  },
});

export const getProgress = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    stats: v.object({
      kindnessGiven: v.number(),
      kindnessReceived: v.number(),
      stickersSent: v.number(),
      stickersReceived: v.number(),
    }),
    customization: v.object({
      themeKey: v.string(),
      frameKey: v.string(),
      bubbleKey: v.string(),
      unlockedPackIds: v.array(v.string()),
    }),
    unlocks: v.array(
      v.object({
        unlockKey: v.string(),
        title: v.string(),
        description: v.string(),
        category: v.string(),
        unlocked: v.boolean(),
        unlockedAt: v.optional(v.number()),
        criterionLabel: v.string(),
        progress: v.number(),
        target: v.number(),
      }),
    ),
    themes: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        description: v.string(),
        unlocked: v.boolean(),
      }),
    ),
    frames: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        description: v.string(),
        unlocked: v.boolean(),
      }),
    ),
    bubbles: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        description: v.string(),
        unlocked: v.boolean(),
      }),
    ),
    presets: v.object({
      encourage: v.array(v.string()),
      motivate: v.array(v.string()),
      congratulate: v.array(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);

    const statsDoc = await ctx.db
      .query("studentSocialStats")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .unique();
    const stats = {
      kindnessGiven: statsDoc?.kindnessGiven ?? 0,
      kindnessReceived: statsDoc?.kindnessReceived ?? 0,
      stickersSent: statsDoc?.stickersSent ?? 0,
      stickersReceived: statsDoc?.stickersReceived ?? 0,
    };

    const customDoc = await ctx.db
      .query("studentCustomization")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .unique();
    const customization = {
      themeKey: customDoc?.themeKey ?? DEFAULT_THEME,
      frameKey: customDoc?.frameKey ?? DEFAULT_FRAME,
      bubbleKey: customDoc?.bubbleKey ?? DEFAULT_BUBBLE,
      unlockedPackIds: customDoc?.unlockedPackIds ?? [STARTER_PACK],
    };

    const earned = await ctx.db
      .query("studentUnlocks")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const earnedMap = new Map(earned.map((u) => [u.unlockKey, u.unlockedAt]));

    const gamification = await ctx.db
      .query("studentGamification")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .unique();
    const level = gamification?.level ?? 1;
    const totalLogs = gamification?.totalLogs ?? 0;

    const unlocks = UNLOCK_DEFS.map((def) => {
      const c = def.criterion;
      let progress = 0;
      const target = c.value;
      let criterionLabel = "";
      switch (c.type) {
        case "kindnessGiven":
          progress = stats.kindnessGiven;
          criterionLabel = `Send ${c.value} kindness messages`;
          break;
        case "kindnessReceived":
          progress = stats.kindnessReceived;
          criterionLabel = `Receive ${c.value} cheers`;
          break;
        case "stickersSent":
          progress = stats.stickersSent;
          criterionLabel = `Send ${c.value} stickers`;
          break;
        case "level":
          progress = level;
          criterionLabel = `Reach level ${c.value}`;
          break;
        case "totalLogs":
          progress = totalLogs;
          criterionLabel = `Log ${c.value} learning sessions`;
          break;
      }
      return {
        unlockKey: def.unlockKey,
        title: def.title,
        description: def.description,
        category: def.category,
        unlocked: earnedMap.has(def.unlockKey),
        unlockedAt: earnedMap.get(def.unlockKey),
        criterionLabel,
        progress: Math.min(progress, target),
        target,
      };
    });

    const allowed = allowedCustomizationKeys(new Set(earnedMap.keys()));

    return {
      stats,
      customization,
      unlocks,
      themes: THEME_OPTIONS.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        unlocked: allowed.themes.has(t.key),
      })),
      frames: FRAME_OPTIONS.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        unlocked: allowed.frames.has(t.key),
      })),
      bubbles: BUBBLE_OPTIONS.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        unlocked: allowed.bubbles.has(t.key),
      })),
      presets: MESSAGE_PRESETS,
    };
  },
});

export const ensureProfile = mutation({
  args: { studentId: v.id("students") },
  returns: v.object({
    customization: customizationDocValidator,
    stats: socialStatsDocValidator,
    newUnlocks: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const { student } = await assertActorIsStudent(ctx, args.studentId);
    const stats = await getOrCreateSocialStats(
      ctx,
      args.studentId,
      student.familyId,
    );
    await getOrCreateCustomization(ctx, args.studentId);
    const newUnlocks = await evaluateUnlocks(ctx, args.studentId);
    const refreshed = await ctx.db
      .query("studentCustomization")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .unique();
    if (!refreshed) throw new Error("Customization missing");
    return { customization: refreshed, stats, newUnlocks };
  },
});

export const updateCustomization = mutation({
  args: {
    studentId: v.id("students"),
    themeKey: v.optional(v.string()),
    frameKey: v.optional(v.string()),
    bubbleKey: v.optional(v.string()),
  },
  returns: customizationDocValidator,
  handler: async (ctx, args) => {
    await assertActorIsStudent(ctx, args.studentId);
    await evaluateUnlocks(ctx, args.studentId);
    const customization = await getOrCreateCustomization(ctx, args.studentId);

    const earned = await ctx.db
      .query("studentUnlocks")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const allowed = allowedCustomizationKeys(
      new Set(earned.map((u) => u.unlockKey)),
    );

    const patch: {
      themeKey?: string;
      frameKey?: string;
      bubbleKey?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.themeKey !== undefined) {
      if (!allowed.themes.has(args.themeKey)) {
        throw new Error("That theme is still locked — keep cheering!");
      }
      patch.themeKey = args.themeKey;
    }
    if (args.frameKey !== undefined) {
      if (!allowed.frames.has(args.frameKey)) {
        throw new Error("That frame is still locked — keep cheering!");
      }
      patch.frameKey = args.frameKey;
    }
    if (args.bubbleKey !== undefined) {
      if (!allowed.bubbles.has(args.bubbleKey)) {
        throw new Error("That chat style is still locked — keep cheering!");
      }
      patch.bubbleKey = args.bubbleKey;
    }

    await ctx.db.patch("studentCustomization", customization._id, patch);
    const updated = await ctx.db.get(
      "studentCustomization",
      customization._id,
    );
    if (!updated) throw new Error("Failed to update customization");
    return updated;
  },
});

export const listFamilyCheers = query({
  args: {
    familyId: v.id("families"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      message: socialMessageDocValidator,
      fromName: v.string(),
      toName: v.string(),
      stickerEmoji: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const limit = Math.min(args.limit ?? 40, 80);
    const messages = await ctx.db
      .query("socialMessages")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .take(limit);

    const out = [];
    for (const message of messages) {
      if (message.deletedAt) continue;
      const from = await ctx.db.get("students", message.fromStudentId);
      const to = await ctx.db.get("students", message.toStudentId);
      let stickerEmoji: string | undefined;
      if (message.stickerKey) {
        const sticker = await findStickerByKey(ctx, message.stickerKey);
        stickerEmoji = sticker?.emoji;
      }
      out.push({
        message,
        fromName: from?.displayName ?? "Student",
        toName: to?.displayName ?? "Student",
        stickerEmoji,
      });
    }
    return out;
  },
});

export const listRecentForStudent = query({
  args: {
    studentId: v.id("students"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      message: socialMessageDocValidator,
      fromName: v.string(),
      stickerEmoji: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStudentFamilyAccess(ctx, args.studentId);
    const limit = Math.min(args.limit ?? 8, 20);
    const messages = await ctx.db
      .query("socialMessages")
      .withIndex("by_to_and_createdAt", (q) =>
        q.eq("toStudentId", args.studentId),
      )
      .order("desc")
      .take(limit);

    const out = [];
    for (const message of messages) {
      if (message.deletedAt) continue;
      const from = await ctx.db.get("students", message.fromStudentId);
      let stickerEmoji: string | undefined;
      if (message.stickerKey) {
        const sticker = await findStickerByKey(ctx, message.stickerKey);
        stickerEmoji = sticker?.emoji;
      }
      out.push({
        message,
        fromName: from?.displayName ?? "Sibling",
        stickerEmoji,
      });
    }
    return out;
  },
});

/** Parent moderation: cheers sent or received by this student. */
export const listInvolvingStudent = query({
  args: {
    studentId: v.id("students"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      message: socialMessageDocValidator,
      fromName: v.string(),
      toName: v.string(),
      direction: v.union(v.literal("sent"), v.literal("received")),
      stickerEmoji: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const { user } = await requireStudentFamilyAccess(ctx, args.studentId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can moderate student cheers");
    }

    const limit = Math.min(args.limit ?? 40, 80);
    const received = await ctx.db
      .query("socialMessages")
      .withIndex("by_to_and_createdAt", (q) =>
        q.eq("toStudentId", args.studentId),
      )
      .order("desc")
      .take(limit);
    const sent = await ctx.db
      .query("socialMessages")
      .withIndex("by_from", (q) => q.eq("fromStudentId", args.studentId))
      .take(limit);

    const byId = new Map<string, Doc<"socialMessages">>();
    for (const m of [...received, ...sent]) {
      if (m.deletedAt) continue;
      byId.set(m._id, m);
    }

    const merged = [...byId.values()].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    const slice = merged.slice(0, limit);

    const out = [];
    for (const message of slice) {
      const from = await ctx.db.get("students", message.fromStudentId);
      const to = await ctx.db.get("students", message.toStudentId);
      let stickerEmoji: string | undefined;
      if (message.stickerKey) {
        const sticker = await findStickerByKey(ctx, message.stickerKey);
        stickerEmoji = sticker?.emoji;
      }
      out.push({
        message,
        fromName: from?.displayName ?? "Student",
        toName: to?.displayName ?? "Student",
        direction:
          message.fromStudentId === args.studentId
            ? ("sent" as const)
            : ("received" as const),
        stickerEmoji,
      });
    }
    return out;
  },
});
