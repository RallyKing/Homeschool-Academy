import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const feedPostTypeValidator = v.union(
  v.literal("kudos"),
  v.literal("sticker"),
  v.literal("log_completed"),
  v.literal("chore_done"),
  v.literal("badge_earned"),
  v.literal("level_up"),
  v.literal("accolade"),
  v.literal("general"),
  v.literal("recheer"),
);

export type FeedPostType =
  | "kudos"
  | "sticker"
  | "log_completed"
  | "chore_done"
  | "badge_earned"
  | "level_up"
  | "accolade"
  | "general"
  | "recheer";

export const feedReactionTypeValidator = v.union(
  v.literal("like"),
  v.literal("love"),
  v.literal("celebrate"),
  v.literal("support"),
  v.literal("funny"),
);

export type FeedReactionType =
  | "like"
  | "love"
  | "celebrate"
  | "support"
  | "funny";

export const REACTION_META: Record<
  FeedReactionType,
  { emoji: string; label: string }
> = {
  like: { emoji: "👍", label: "Like" },
  love: { emoji: "❤️", label: "Love" },
  celebrate: { emoji: "🎉", label: "Celebrate" },
  support: { emoji: "💪", label: "Support" },
  funny: { emoji: "😄", label: "Funny" },
};

export const feedPostDocValidator = v.object({
  _id: v.id("feedPosts"),
  _creationTime: v.number(),
  familyId: v.id("families"),
  type: feedPostTypeValidator,
  actorStudentId: v.optional(v.id("students")),
  targetStudentId: v.optional(v.id("students")),
  title: v.string(),
  body: v.optional(v.string()),
  stickerKey: v.optional(v.string()),
  href: v.optional(v.string()),
  sourceTable: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  visibility: v.literal("family"),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  createdByUserId: v.optional(v.id("users")),
  isRecheer: v.optional(v.boolean()),
  originalPostId: v.optional(v.id("feedPosts")),
  imageStorageId: v.optional(v.id("_storage")),
  pinnedAt: v.optional(v.number()),
  mentionsStudentIds: v.optional(v.array(v.id("students"))),
});

export const reactionSummaryValidator = v.object({
  type: feedReactionTypeValidator,
  count: v.number(),
  emoji: v.string(),
  label: v.string(),
});

export const reactionActorValidator = v.object({
  name: v.string(),
  type: feedReactionTypeValidator,
  emoji: v.string(),
  actorType: v.union(v.literal("user"), v.literal("student")),
});

export const feedCommentDocValidator = v.object({
  _id: v.id("feedComments"),
  _creationTime: v.number(),
  postId: v.id("feedPosts"),
  familyId: v.id("families"),
  body: v.string(),
  stickerKey: v.optional(v.string()),
  authorUserId: v.optional(v.id("users")),
  authorStudentId: v.optional(v.id("students")),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),
});

export const enrichedCommentValidator = v.object({
  comment: feedCommentDocValidator,
  authorName: v.string(),
  authorImageStorageId: v.optional(v.id("_storage")),
  stickerEmoji: v.optional(v.string()),
  stickerLabel: v.optional(v.string()),
});

const originalPreviewValidator = v.object({
  _id: v.id("feedPosts"),
  title: v.string(),
  body: v.optional(v.string()),
  stickerKey: v.optional(v.string()),
  stickerEmoji: v.optional(v.string()),
  actorName: v.union(v.string(), v.null()),
  actorStudentId: v.optional(v.id("students")),
  actorImageStorageId: v.optional(v.id("_storage")),
  type: feedPostTypeValidator,
  createdAt: v.number(),
});

export type CreateFeedPostArgs = {
  familyId: Id<"families">;
  type: FeedPostType;
  actorStudentId?: Id<"students">;
  targetStudentId?: Id<"students">;
  title: string;
  body?: string;
  stickerKey?: string;
  href?: string;
  sourceTable?: string;
  sourceId?: string;
  createdByUserId?: Id<"users">;
  isRecheer?: boolean;
  originalPostId?: Id<"feedPosts">;
  imageStorageId?: Id<"_storage">;
  mentionsStudentIds?: Id<"students">[];
};

const TITLE_MAX = 160;
const BODY_MAX = 500;
const COMMENT_MAX = 400;

export function normalizeFeedTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Feed post title is required");
  if (trimmed.length > TITLE_MAX) {
    throw new Error(`Title must be ${TITLE_MAX} characters or fewer`);
  }
  return trimmed;
}

export function normalizeFeedBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > BODY_MAX) {
    throw new Error(`Body must be ${BODY_MAX} characters or fewer`);
  }
  return trimmed;
}

export function normalizeCommentBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");
  if (trimmed.length > COMMENT_MAX) {
    throw new Error(`Comment must be ${COMMENT_MAX} characters or fewer`);
  }
  return trimmed;
}

/** Resolve @DisplayName mentions against siblings in the family. */
export async function resolveMentions(
  ctx: QueryCtx | MutationCtx,
  familyId: Id<"families">,
  text: string,
): Promise<Id<"students">[]> {
  const students = await ctx.db
    .query("students")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  const found = new Set<Id<"students">>();
  for (const student of students) {
    const needle = `@${student.displayName}`;
    if (text.toLowerCase().includes(needle.toLowerCase())) {
      found.add(student._id);
    }
  }
  return [...found];
}

/** Insert a family-wall post. Always visibility: family (never public internet). */
export async function createFeedPost(
  ctx: MutationCtx,
  args: CreateFeedPostArgs,
): Promise<Id<"feedPosts">> {
  const title = normalizeFeedTitle(args.title);
  const body = normalizeFeedBody(args.body);
  return await ctx.db.insert("feedPosts", {
    familyId: args.familyId,
    type: args.type,
    actorStudentId: args.actorStudentId,
    targetStudentId: args.targetStudentId,
    title,
    body,
    stickerKey: args.stickerKey,
    href: args.href,
    sourceTable: args.sourceTable,
    sourceId: args.sourceId,
    visibility: "family",
    createdAt: Date.now(),
    createdByUserId: args.createdByUserId,
    isRecheer: args.isRecheer,
    originalPostId: args.originalPostId,
    imageStorageId: args.imageStorageId,
    mentionsStudentIds: args.mentionsStudentIds,
  });
}

async function resolveActorName(
  ctx: QueryCtx | MutationCtx,
  post: Doc<"feedPosts">,
): Promise<{
  actorName: string | null;
  actorImageStorageId: Id<"_storage"> | undefined;
}> {
  if (post.actorStudentId) {
    const actor = await ctx.db.get("students", post.actorStudentId);
    return {
      actorName: actor?.displayName ?? "Student",
      actorImageStorageId: actor?.imageStorageId,
    };
  }
  if (post.createdByUserId) {
    const user = await ctx.db.get("users", post.createdByUserId);
    return {
      actorName: user?.name ?? "Family member",
      actorImageStorageId: undefined,
    };
  }
  return { actorName: null, actorImageStorageId: undefined };
}

async function resolveSticker(
  ctx: QueryCtx | MutationCtx,
  stickerKey: string | undefined,
): Promise<{ emoji?: string; label?: string }> {
  if (!stickerKey) return {};
  const sticker = await ctx.db
    .query("stickers")
    .withIndex("by_stickerKey", (q) => q.eq("stickerKey", stickerKey))
    .unique();
  return { emoji: sticker?.emoji, label: sticker?.label };
}

export async function enrichComment(
  ctx: QueryCtx | MutationCtx,
  comment: Doc<"feedComments">,
) {
  let authorName = "Someone";
  let authorImageStorageId: Id<"_storage"> | undefined;
  if (comment.authorStudentId) {
    const student = await ctx.db.get("students", comment.authorStudentId);
    authorName = student?.displayName ?? "Student";
    authorImageStorageId = student?.imageStorageId;
  } else if (comment.authorUserId) {
    const user = await ctx.db.get("users", comment.authorUserId);
    authorName = user?.name ?? "Family member";
  }
  const sticker = await resolveSticker(ctx, comment.stickerKey);
  return {
    comment,
    authorName,
    authorImageStorageId,
    stickerEmoji: sticker.emoji,
    stickerLabel: sticker.label,
  };
}

export async function enrichFeedPost(
  ctx: QueryCtx | MutationCtx,
  post: Doc<"feedPosts">,
  viewer?: {
    userId: Id<"users">;
    studentId?: Id<"students">;
  },
): Promise<{
  post: Doc<"feedPosts">;
  actorName: string | null;
  targetName: string | null;
  actorImageStorageId: Id<"_storage"> | undefined;
  stickerEmoji: string | undefined;
  stickerLabel: string | undefined;
  imageUrl: string | null;
  reactionSummary: Array<{
    type: FeedReactionType;
    count: number;
    emoji: string;
    label: string;
  }>;
  reactionActors: Array<{
    name: string;
    type: FeedReactionType;
    emoji: string;
    actorType: "user" | "student";
  }>;
  myReaction: FeedReactionType | null;
  commentCount: number;
  originalPreview: {
    _id: Id<"feedPosts">;
    title: string;
    body?: string;
    stickerKey?: string;
    stickerEmoji?: string;
    actorName: string | null;
    actorStudentId?: Id<"students">;
    actorImageStorageId?: Id<"_storage">;
    type: FeedPostType;
    createdAt: number;
  } | null;
}> {
  const { actorName, actorImageStorageId } = await resolveActorName(ctx, post);

  let targetName: string | null = null;
  if (post.targetStudentId) {
    const target = await ctx.db.get("students", post.targetStudentId);
    targetName = target?.displayName ?? "Student";
  }

  const sticker = await resolveSticker(ctx, post.stickerKey);

  let imageUrl: string | null = null;
  if (post.imageStorageId) {
    imageUrl = await ctx.storage.getUrl(post.imageStorageId);
  }

  const reactions = await ctx.db
    .query("feedReactions")
    .withIndex("by_post", (q) => q.eq("postId", post._id))
    .collect();

  const counts = new Map<FeedReactionType, number>();
  for (const r of reactions) {
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  }
  const reactionSummary = (
    ["like", "love", "celebrate", "support", "funny"] as FeedReactionType[]
  )
    .filter((t) => (counts.get(t) ?? 0) > 0)
    .map((type) => ({
      type,
      count: counts.get(type)!,
      emoji: REACTION_META[type].emoji,
      label: REACTION_META[type].label,
    }));

  const reactionActors = [];
  for (const r of reactions.slice(0, 12)) {
    let name = "Someone";
    if (r.actorStudentId) {
      const s = await ctx.db.get("students", r.actorStudentId);
      name = s?.displayName ?? "Student";
    } else if (r.actorUserId) {
      const u = await ctx.db.get("users", r.actorUserId);
      name = u?.name ?? "Family member";
    }
    reactionActors.push({
      name,
      type: r.type,
      emoji: REACTION_META[r.type].emoji,
      actorType: r.actorType,
    });
  }

  let myReaction: FeedReactionType | null = null;
  if (viewer) {
    if (viewer.studentId) {
      const mine = reactions.find((r) => r.actorStudentId === viewer.studentId);
      myReaction = mine?.type ?? null;
    }
    if (myReaction === null) {
      const mine = reactions.find(
        (r) => r.actorUserId === viewer.userId && !r.actorStudentId,
      );
      myReaction = mine?.type ?? null;
    }
  }

  const comments = await ctx.db
    .query("feedComments")
    .withIndex("by_post", (q) => q.eq("postId", post._id))
    .collect();
  const commentCount = comments.filter((c) => !c.deletedAt).length;

  let originalPreview: {
    _id: Id<"feedPosts">;
    title: string;
    body?: string;
    stickerKey?: string;
    stickerEmoji?: string;
    actorName: string | null;
    actorStudentId?: Id<"students">;
    actorImageStorageId?: Id<"_storage">;
    type: FeedPostType;
    createdAt: number;
  } | null = null;

  if (post.originalPostId) {
    const original = await ctx.db.get("feedPosts", post.originalPostId);
    if (original) {
      const origActor = await resolveActorName(ctx, original);
      const origSticker = await resolveSticker(ctx, original.stickerKey);
      originalPreview = {
        _id: original._id,
        title: original.title,
        body: original.body,
        stickerKey: original.stickerKey,
        stickerEmoji: origSticker.emoji,
        actorName: origActor.actorName,
        actorStudentId: original.actorStudentId,
        actorImageStorageId: origActor.actorImageStorageId,
        type: original.type,
        createdAt: original.createdAt,
      };
    }
  }

  return {
    post,
    actorName,
    targetName,
    actorImageStorageId,
    stickerEmoji: sticker.emoji,
    stickerLabel: sticker.label,
    imageUrl,
    reactionSummary,
    reactionActors,
    myReaction,
    commentCount,
    originalPreview,
  };
}

export const enrichedFeedPostValidator = v.object({
  post: feedPostDocValidator,
  actorName: v.union(v.string(), v.null()),
  targetName: v.union(v.string(), v.null()),
  actorImageStorageId: v.optional(v.id("_storage")),
  stickerEmoji: v.optional(v.string()),
  stickerLabel: v.optional(v.string()),
  imageUrl: v.union(v.string(), v.null()),
  reactionSummary: v.array(reactionSummaryValidator),
  reactionActors: v.array(reactionActorValidator),
  myReaction: v.union(feedReactionTypeValidator, v.null()),
  commentCount: v.number(),
  originalPreview: v.union(originalPreviewValidator, v.null()),
});

export async function deleteReactionsForPost(
  ctx: MutationCtx,
  postId: Id<"feedPosts">,
): Promise<void> {
  const reactions = await ctx.db
    .query("feedReactions")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect();
  for (const r of reactions) {
    await ctx.db.delete("feedReactions", r._id);
  }
}

export async function deleteCommentsForPost(
  ctx: MutationCtx,
  postId: Id<"feedPosts">,
): Promise<void> {
  const comments = await ctx.db
    .query("feedComments")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect();
  for (const c of comments) {
    await ctx.db.delete("feedComments", c._id);
  }
}

export async function cascadeDeleteFeedPost(
  ctx: MutationCtx,
  postId: Id<"feedPosts">,
): Promise<void> {
  await deleteReactionsForPost(ctx, postId);
  await deleteCommentsForPost(ctx, postId);

  const recheers = await ctx.db
    .query("feedPosts")
    .withIndex("by_original", (q) => q.eq("originalPostId", postId))
    .collect();
  for (const r of recheers) {
    await cascadeDeleteFeedPost(ctx, r._id);
  }

  await ctx.db.delete("feedPosts", postId);
}

export async function deleteFeedForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
  familyId: Id<"families">,
): Promise<void> {
  const posts = await ctx.db
    .query("feedPosts")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const post of posts) {
    if (
      post.actorStudentId === studentId ||
      post.targetStudentId === studentId
    ) {
      await cascadeDeleteFeedPost(ctx, post._id);
    }
  }

  const reactions = await ctx.db
    .query("feedReactions")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const r of reactions) {
    if (r.actorStudentId === studentId) {
      await ctx.db.delete("feedReactions", r._id);
    }
  }

  const comments = await ctx.db
    .query("feedComments")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const c of comments) {
    if (c.authorStudentId === studentId) {
      await ctx.db.delete("feedComments", c._id);
    }
  }
}

export async function deleteFeedForFamily(
  ctx: MutationCtx,
  familyId: Id<"families">,
): Promise<void> {
  const posts = await ctx.db
    .query("feedPosts")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .collect();
  for (const post of posts) {
    await cascadeDeleteFeedPost(ctx, post._id);
  }

  const reads = await ctx.db
    .query("feedWallReads")
    .withIndex("by_family_and_user", (q) => q.eq("familyId", familyId))
    .collect();
  for (const r of reads) {
    await ctx.db.delete("feedWallReads", r._id);
  }
}

/** Resolve viewer student id for reaction/comment attribution. */
export async function resolveViewerStudentId(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  familyId: Id<"families">,
  preferredStudentId?: Id<"students">,
): Promise<Id<"students"> | undefined> {
  if (preferredStudentId) {
    const student = await ctx.db.get("students", preferredStudentId);
    if (student && student.familyId === familyId) {
      if (
        student.userId === user._id ||
        user.role === "parent" ||
        user.role === "superAdmin"
      ) {
        // Parents composing as themselves shouldn't use student actor unless linked.
        if (student.userId === user._id) return preferredStudentId;
      }
    }
  }
  const linked = await ctx.db
    .query("students")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (linked && linked.familyId === familyId) return linked._id;
  return undefined;
}
