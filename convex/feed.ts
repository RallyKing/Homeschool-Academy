import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  requireFamilyAccess,
  requireFamilyReadAccess,
  requireStudentFamilyAccess,
} from "./lib/auth";
import {
  createFeedPost,
  enrichedFeedPostValidator,
  enrichFeedPost,
  feedPostDocValidator,
  feedPostTypeValidator,
  normalizeFeedBody,
  normalizeFeedTitle,
} from "./lib/feed";

async function assertCanModerateFeed(
  ctx: MutationCtx,
  post: Doc<"feedPosts">,
): Promise<{ user: Doc<"users">; isParent: boolean }> {
  const { user } = await requireFamilyAccess(ctx, post.familyId);
  const isParent = user.role === "parent" || user.role === "superAdmin";
  if (isParent) return { user, isParent: true };

  // Students may edit/delete posts they authored (as actor or createdBy).
  if (post.createdByUserId === user._id) {
    return { user, isParent: false };
  }

  if (post.actorStudentId) {
    const student = await ctx.db.get("students", post.actorStudentId);
    if (student && student.userId === user._id) {
      return { user, isParent: false };
    }
  }

  throw new Error("Unauthorized: you can only change your own wall posts");
}

export const create = mutation({
  args: {
    familyId: v.id("families"),
    type: v.optional(feedPostTypeValidator),
    actorStudentId: v.optional(v.id("students")),
    targetStudentId: v.optional(v.id("students")),
    title: v.string(),
    body: v.optional(v.string()),
    stickerKey: v.optional(v.string()),
    href: v.optional(v.string()),
  },
  returns: v.id("feedPosts"),
  handler: async (ctx, args) => {
    const { user } = await requireFamilyAccess(ctx, args.familyId);
    const isParent = user.role === "parent" || user.role === "superAdmin";

    let actorStudentId = args.actorStudentId;
    if (!isParent) {
      // Students may only post as themselves.
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (!linked || linked.familyId !== args.familyId) {
        throw new Error("Unauthorized: link a student profile in this family");
      }
      actorStudentId = linked._id;
    } else if (actorStudentId) {
      await requireStudentFamilyAccess(ctx, actorStudentId);
    }

    if (args.targetStudentId) {
      const target = await ctx.db.get("students", args.targetStudentId);
      if (!target || target.familyId !== args.familyId) {
        throw new Error("Target student must be in this family");
      }
    }

    return await createFeedPost(ctx, {
      familyId: args.familyId,
      type: args.type ?? "general",
      actorStudentId,
      targetStudentId: args.targetStudentId,
      title: args.title,
      body: args.body,
      stickerKey: args.stickerKey,
      href: args.href,
      createdByUserId: user._id,
    });
  },
});

export const get = query({
  args: { postId: v.id("feedPosts") },
  returns: v.union(enrichedFeedPostValidator, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) return null;
    await requireFamilyReadAccess(ctx, post.familyId);
    return await enrichFeedPost(ctx, post);
  },
});

export const list = query({
  args: {
    familyId: v.id("families"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(enrichedFeedPostValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireFamilyReadAccess(ctx, args.familyId);
    const result = await ctx.db
      .query("feedPosts")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = [];
    for (const post of result.page) {
      page.push(await enrichFeedPost(ctx, post));
    }
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/** Convenience non-paginated read for small families / dashboards. */
export const listRecent = query({
  args: {
    familyId: v.id("families"),
    limit: v.optional(v.number()),
  },
  returns: v.array(enrichedFeedPostValidator),
  handler: async (ctx, args) => {
    await requireFamilyReadAccess(ctx, args.familyId);
    const limit = Math.min(args.limit ?? 40, 80);
    const posts = await ctx.db
      .query("feedPosts")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .take(limit);

    const out = [];
    for (const post of posts) {
      out.push(await enrichFeedPost(ctx, post));
    }
    return out;
  },
});

export const update = mutation({
  args: {
    postId: v.id("feedPosts"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: feedPostDocValidator,
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    await assertCanModerateFeed(ctx, post);

    const patch: {
      title?: string;
      body?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      patch.title = normalizeFeedTitle(args.title);
    }
    if (args.body !== undefined) {
      patch.body = normalizeFeedBody(args.body);
    }

    await ctx.db.patch("feedPosts", args.postId, patch);
    const updated = await ctx.db.get("feedPosts", args.postId);
    if (!updated) throw new Error("Failed to update post");
    return updated;
  },
});

export const remove = mutation({
  args: { postId: v.id("feedPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    await assertCanModerateFeed(ctx, post);
    await ctx.db.delete("feedPosts", args.postId);
    return null;
  },
});

/** Parent-only hard delete (moderation). */
export const moderateRemove = mutation({
  args: { postId: v.id("feedPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    const { user } = await requireFamilyAccess(ctx, post.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can moderate the family wall");
    }
    await ctx.db.delete("feedPosts", args.postId);
    return null;
  },
});
