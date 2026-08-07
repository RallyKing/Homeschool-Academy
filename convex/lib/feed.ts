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
);

export type FeedPostType =
  | "kudos"
  | "sticker"
  | "log_completed"
  | "chore_done"
  | "badge_earned"
  | "level_up"
  | "accolade"
  | "general";

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
};

const TITLE_MAX = 160;
const BODY_MAX = 500;

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
  });
}

export async function enrichFeedPost(
  ctx: QueryCtx | MutationCtx,
  post: Doc<"feedPosts">,
): Promise<{
  post: Doc<"feedPosts">;
  actorName: string | null;
  targetName: string | null;
  actorImageStorageId: Id<"_storage"> | undefined;
  stickerEmoji: string | undefined;
  stickerLabel: string | undefined;
}> {
  let actorName: string | null = null;
  let actorImageStorageId: Id<"_storage"> | undefined;
  if (post.actorStudentId) {
    const actor = await ctx.db.get("students", post.actorStudentId);
    actorName = actor?.displayName ?? "Student";
    actorImageStorageId = actor?.imageStorageId;
  }

  let targetName: string | null = null;
  if (post.targetStudentId) {
    const target = await ctx.db.get("students", post.targetStudentId);
    targetName = target?.displayName ?? "Student";
  }

  let stickerEmoji: string | undefined;
  let stickerLabel: string | undefined;
  if (post.stickerKey) {
    const sticker = await ctx.db
      .query("stickers")
      .withIndex("by_stickerKey", (q) => q.eq("stickerKey", post.stickerKey!))
      .unique();
    stickerEmoji = sticker?.emoji;
    stickerLabel = sticker?.label;
  }

  return {
    post,
    actorName,
    targetName,
    actorImageStorageId,
    stickerEmoji,
    stickerLabel,
  };
}

export const enrichedFeedPostValidator = v.object({
  post: feedPostDocValidator,
  actorName: v.union(v.string(), v.null()),
  targetName: v.union(v.string(), v.null()),
  actorImageStorageId: v.optional(v.id("_storage")),
  stickerEmoji: v.optional(v.string()),
  stickerLabel: v.optional(v.string()),
});

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
      await ctx.db.delete("feedPosts", post._id);
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
    await ctx.db.delete("feedPosts", post._id);
  }
}
