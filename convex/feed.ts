import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { alertFamily, alertStudent } from "./lib/alerts";
import {
  getCurrentUser,
  getFamilyMembership,
  requireFamilyAccess,
  requireFamilyReadAccess,
  requireFeedCircleAccess,
} from "./lib/auth";
import {
  cascadeDeleteFeedPost,
  createFeedPost,
  enrichComment,
  enrichFeedPost,
  enrichedCommentValidator,
  enrichedFeedPostValidator,
  feedPostDocValidator,
  feedPostTypeValidator,
  feedReactionTypeValidator,
  normalizeCommentBody,
  normalizeFeedBody,
  normalizeFeedTitle,
  REACTION_META,
  resolveMentions,
  resolveViewerStudentId,
  type FeedReactionType,
} from "./lib/feed";

async function assertCanModerateFeed(
  ctx: MutationCtx,
  post: Doc<"feedPosts">,
): Promise<{ user: Doc<"users">; isParent: boolean }> {
  const user = await requireFeedCircleAccess(ctx, post.familyId);
  const membership = await getFamilyMembership(ctx, post.familyId, user._id);
  const isParent =
    user.role === "superAdmin" ||
    (membership !== null &&
      (user.role === "parent" || membership.role === "parent" || membership.role === "guardian"));

  if (isParent) return { user, isParent: true };

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

async function viewerContext(
  ctx: QueryCtx | MutationCtx,
  familyId: Id<"families">,
  asStudentId?: Id<"students">,
) {
  const user = await requireFeedCircleAccess(ctx, familyId);
  const studentId = await resolveViewerStudentId(
    ctx,
    user,
    familyId,
    asStudentId,
  );
  return { user, studentId };
}

async function notifyPostAuthor(
  ctx: MutationCtx,
  post: Doc<"feedPosts">,
  args: {
    type: "feed_comment" | "feed_reaction" | "feed_recheer";
    title: string;
    body: string;
    createdBy: Id<"users">;
  },
) {
  const href = "/family/cheers?tab=wall";
  if (post.actorStudentId) {
    await alertStudent(ctx, {
      studentId: post.actorStudentId,
      type: args.type,
      title: args.title,
      body: args.body,
      href,
      createdBy: args.createdBy,
      sourceTable: "feedPosts",
      sourceId: post._id,
    });
  } else {
    await alertFamily(ctx, {
      familyId: post.familyId,
      type: args.type,
      title: args.title,
      body: args.body,
      href,
      createdBy: args.createdBy,
      sourceTable: "feedPosts",
      sourceId: post._id,
    });
  }
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

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
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("feedPosts"),
  handler: async (ctx, args) => {
    const user = await requireFeedCircleAccess(ctx, args.familyId);
    const membership = await getFamilyMembership(ctx, args.familyId, user._id);
    const isParent =
      user.role === "superAdmin" ||
      (membership !== null &&
        (user.role === "parent" ||
          membership.role === "parent" ||
          membership.role === "guardian"));
    const isTeacher = user.role === "teacher" && !membership;

    let actorStudentId = args.actorStudentId;
    if (!isParent && !isTeacher) {
      const linked = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (!linked || linked.familyId !== args.familyId) {
        throw new Error("Unauthorized: link a student profile in this family");
      }
      actorStudentId = linked._id;
    } else if (actorStudentId) {
      const student = await ctx.db.get("students", actorStudentId);
      if (!student || student.familyId !== args.familyId) {
        throw new Error("Actor student must be in this family");
      }
    }

    if (args.targetStudentId) {
      const target = await ctx.db.get("students", args.targetStudentId);
      if (!target || target.familyId !== args.familyId) {
        throw new Error("Target student must be in this family");
      }
    }

    if (args.stickerKey) {
      const sticker = await ctx.db
        .query("stickers")
        .withIndex("by_stickerKey", (q) => q.eq("stickerKey", args.stickerKey!))
        .unique();
      if (!sticker) throw new Error("Sticker not found");
    }

    const textForMentions = `${args.title} ${args.body ?? ""}`;
    const mentionsStudentIds = await resolveMentions(
      ctx,
      args.familyId,
      textForMentions,
    );

    const postId = await createFeedPost(ctx, {
      familyId: args.familyId,
      type: args.type ?? (args.stickerKey ? "sticker" : "general"),
      actorStudentId,
      targetStudentId: args.targetStudentId,
      title: args.title,
      body: args.body,
      stickerKey: args.stickerKey,
      href: args.href ?? "/family/cheers?tab=wall",
      imageStorageId: args.imageStorageId,
      createdByUserId: user._id,
      mentionsStudentIds:
        mentionsStudentIds.length > 0 ? mentionsStudentIds : undefined,
    });

    for (const mentionedId of mentionsStudentIds) {
      if (mentionedId === actorStudentId) continue;
      await alertStudent(ctx, {
        studentId: mentionedId,
        type: "general",
        title: "You were mentioned on the wall",
        body: args.title.trim().slice(0, 120),
        href: "/family/cheers?tab=wall",
        createdBy: user._id,
        sourceTable: "feedPosts",
        sourceId: postId,
      });
    }

    if (isTeacher && args.targetStudentId) {
      await alertStudent(ctx, {
        studentId: args.targetStudentId,
        type: "kudos_received",
        title: "A teacher cheered for you",
        body: args.title.trim().slice(0, 120),
        href: "/student/social?tab=wall",
        createdBy: user._id,
        sourceTable: "feedPosts",
        sourceId: postId,
      });
    }

    return postId;
  },
});

export const get = query({
  args: {
    postId: v.id("feedPosts"),
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.union(enrichedFeedPostValidator, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) return null;
    const { user, studentId } = await viewerContext(
      ctx,
      post.familyId,
      args.asStudentId,
    );
    return await enrichFeedPost(ctx, post, {
      userId: user._id,
      studentId,
    });
  },
});

export const list = query({
  args: {
    familyId: v.id("families"),
    paginationOpts: paginationOptsValidator,
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.object({
    page: v.array(enrichedFeedPostValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const { user, studentId } = await viewerContext(
      ctx,
      args.familyId,
      args.asStudentId,
    );
    const result = await ctx.db
      .query("feedPosts")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = [];
    for (const post of result.page) {
      page.push(
        await enrichFeedPost(ctx, post, { userId: user._id, studentId }),
      );
    }

    // Pinned posts first within the current page set (full pin sort on first page).
    page.sort((a, b) => {
      const ap = a.post.pinnedAt ?? 0;
      const bp = b.post.pinnedAt ?? 0;
      if (ap !== bp) return bp - ap;
      return b.post.createdAt - a.post.createdAt;
    });

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
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.array(enrichedFeedPostValidator),
  handler: async (ctx, args) => {
    const { user, studentId } = await viewerContext(
      ctx,
      args.familyId,
      args.asStudentId,
    );
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
      out.push(
        await enrichFeedPost(ctx, post, { userId: user._id, studentId }),
      );
    }
    out.sort((a, b) => {
      const ap = a.post.pinnedAt ?? 0;
      const bp = b.post.pinnedAt ?? 0;
      if (ap !== bp) return bp - ap;
      return b.post.createdAt - a.post.createdAt;
    });
    return out;
  },
});

export const update = mutation({
  args: {
    postId: v.id("feedPosts"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    stickerKey: v.optional(v.string()),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: feedPostDocValidator,
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    await assertCanModerateFeed(ctx, post);

    const patch: {
      title?: string;
      body?: string;
      stickerKey?: string;
      imageStorageId?: Id<"_storage">;
      mentionsStudentIds?: Id<"students">[];
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      patch.title = normalizeFeedTitle(args.title);
    }
    if (args.body !== undefined) {
      patch.body = normalizeFeedBody(args.body);
    }
    if (args.stickerKey !== undefined) {
      if (args.stickerKey) {
        const sticker = await ctx.db
          .query("stickers")
          .withIndex("by_stickerKey", (q) =>
            q.eq("stickerKey", args.stickerKey!),
          )
          .unique();
        if (!sticker) throw new Error("Sticker not found");
      }
      patch.stickerKey = args.stickerKey || undefined;
    }
    if (args.imageStorageId !== undefined) {
      if (args.imageStorageId === null) {
        await ctx.db.patch("feedPosts", args.postId, {
          updatedAt: Date.now(),
        });
        // Convex patch cannot unset optional fields; use replace without image.
        const current = await ctx.db.get("feedPosts", args.postId);
        if (!current) throw new Error("Post not found");
        await ctx.db.replace("feedPosts", args.postId, {
          familyId: current.familyId,
          type: current.type,
          actorStudentId: current.actorStudentId,
          targetStudentId: current.targetStudentId,
          title: patch.title ?? current.title,
          body: patch.body !== undefined ? patch.body : current.body,
          stickerKey:
            patch.stickerKey !== undefined
              ? patch.stickerKey
              : current.stickerKey,
          href: current.href,
          sourceTable: current.sourceTable,
          sourceId: current.sourceId,
          visibility: current.visibility,
          createdAt: current.createdAt,
          updatedAt: Date.now(),
          createdByUserId: current.createdByUserId,
          isRecheer: current.isRecheer,
          originalPostId: current.originalPostId,
          pinnedAt: current.pinnedAt,
          mentionsStudentIds: await resolveMentions(
            ctx,
            current.familyId,
            `${patch.title ?? current.title} ${
              patch.body !== undefined ? patch.body : (current.body ?? "")
            }`,
          ),
        });
        const updated = await ctx.db.get("feedPosts", args.postId);
        if (!updated) throw new Error("Failed to update post");
        return updated;
      }
      patch.imageStorageId = args.imageStorageId;
    }

    const nextTitle = patch.title ?? post.title;
    const nextBody = patch.body !== undefined ? patch.body : post.body;
    patch.mentionsStudentIds = await resolveMentions(
      ctx,
      post.familyId,
      `${nextTitle} ${nextBody ?? ""}`,
    );

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
    await cascadeDeleteFeedPost(ctx, args.postId);
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
    await cascadeDeleteFeedPost(ctx, args.postId);
    return null;
  },
});

export const setPinned = mutation({
  args: {
    postId: v.id("feedPosts"),
    pinned: v.boolean(),
  },
  returns: feedPostDocValidator,
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    const { user } = await requireFamilyAccess(ctx, post.familyId);
    if (user.role !== "parent" && user.role !== "superAdmin") {
      throw new Error("Only parents can pin wall posts");
    }
    await ctx.db.patch("feedPosts", args.postId, {
      pinnedAt: args.pinned ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("feedPosts", args.postId);
    if (!updated) throw new Error("Failed to update post");
    return updated;
  },
});

// ── Reactions ──────────────────────────────────────────────────────────────

export const setReaction = mutation({
  args: {
    postId: v.id("feedPosts"),
    type: feedReactionTypeValidator,
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.id("feedReactions"),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    const { user, studentId } = await viewerContext(
      ctx,
      post.familyId,
      args.asStudentId,
    );

    let existing: Doc<"feedReactions"> | null = null;
    if (studentId) {
      existing = await ctx.db
        .query("feedReactions")
        .withIndex("by_post_and_student", (q) =>
          q.eq("postId", post._id).eq("actorStudentId", studentId),
        )
        .unique();
    }
    if (!existing) {
      existing = await ctx.db
        .query("feedReactions")
        .withIndex("by_post_and_user", (q) =>
          q.eq("postId", post._id).eq("actorUserId", user._id),
        )
        .first();
      // Prefer student-attributed row when acting as student.
      if (existing && studentId && existing.actorStudentId !== studentId) {
        // Keep looking — user may have reacted as parent before.
        const asUserOnly = await ctx.db
          .query("feedReactions")
          .withIndex("by_post_and_user", (q) =>
            q.eq("postId", post._id).eq("actorUserId", user._id),
          )
          .collect();
        existing =
          asUserOnly.find((r) => !r.actorStudentId) ??
          asUserOnly[0] ??
          null;
      }
    }

    if (existing) {
      await ctx.db.patch("feedReactions", existing._id, {
        type: args.type,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    const id = await ctx.db.insert("feedReactions", {
      postId: post._id,
      familyId: post.familyId,
      actorType: studentId ? "student" : "user",
      actorUserId: user._id,
      actorStudentId: studentId,
      type: args.type,
      createdAt: Date.now(),
    });

    const actorLabel = studentId
      ? ((await ctx.db.get("students", studentId))?.displayName ?? "Someone")
      : (user.name ?? "Someone");
    const meta = REACTION_META[args.type as FeedReactionType];
    const isSelf =
      (studentId && post.actorStudentId === studentId) ||
      post.createdByUserId === user._id;
    if (!isSelf) {
      await notifyPostAuthor(ctx, post, {
        type: "feed_reaction",
        title: `${actorLabel} reacted ${meta.emoji}`,
        body: `On “${post.title.slice(0, 80)}”`,
        createdBy: user._id,
      });
    }

    return id;
  },
});

export const removeReaction = mutation({
  args: {
    postId: v.id("feedPosts"),
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    const { user, studentId } = await viewerContext(
      ctx,
      post.familyId,
      args.asStudentId,
    );

    const reactions = await ctx.db
      .query("feedReactions")
      .withIndex("by_post", (q) => q.eq("postId", post._id))
      .collect();

    for (const r of reactions) {
      const mineStudent = studentId && r.actorStudentId === studentId;
      const mineUser =
        r.actorUserId === user._id &&
        (!studentId || !r.actorStudentId || r.actorStudentId === studentId);
      if (mineStudent || mineUser) {
        await ctx.db.delete("feedReactions", r._id);
      }
    }
    return null;
  },
});

export const listReactions = query({
  args: { postId: v.id("feedPosts") },
  returns: v.array(
    v.object({
      _id: v.id("feedReactions"),
      type: feedReactionTypeValidator,
      emoji: v.string(),
      label: v.string(),
      name: v.string(),
      actorType: v.union(v.literal("user"), v.literal("student")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) return [];
    await requireFamilyReadAccess(ctx, post.familyId);
    const reactions = await ctx.db
      .query("feedReactions")
      .withIndex("by_post", (q) => q.eq("postId", post._id))
      .collect();
    const out = [];
    for (const r of reactions) {
      let name = "Someone";
      if (r.actorStudentId) {
        const s = await ctx.db.get("students", r.actorStudentId);
        name = s?.displayName ?? "Student";
      } else if (r.actorUserId) {
        const u = await ctx.db.get("users", r.actorUserId);
        name = u?.name ?? "Family member";
      }
      out.push({
        _id: r._id,
        type: r.type,
        emoji: REACTION_META[r.type].emoji,
        label: REACTION_META[r.type].label,
        name,
        actorType: r.actorType,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

// ── Comments ───────────────────────────────────────────────────────────────

export const listComments = query({
  args: { postId: v.id("feedPosts") },
  returns: v.array(enrichedCommentValidator),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) return [];
    await requireFamilyReadAccess(ctx, post.familyId);
    const comments = await ctx.db
      .query("feedComments")
      .withIndex("by_post_and_createdAt", (q) => q.eq("postId", post._id))
      .order("asc")
      .collect();
    const out = [];
    for (const c of comments) {
      if (c.deletedAt) continue;
      out.push(await enrichComment(ctx, c));
    }
    return out;
  },
});

export const addComment = mutation({
  args: {
    postId: v.id("feedPosts"),
    body: v.string(),
    stickerKey: v.optional(v.string()),
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.id("feedComments"),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    const { user, studentId } = await viewerContext(
      ctx,
      post.familyId,
      args.asStudentId,
    );
    const body = normalizeCommentBody(args.body);

    if (args.stickerKey) {
      const sticker = await ctx.db
        .query("stickers")
        .withIndex("by_stickerKey", (q) => q.eq("stickerKey", args.stickerKey!))
        .unique();
      if (!sticker) throw new Error("Sticker not found");
    }

    const id = await ctx.db.insert("feedComments", {
      postId: post._id,
      familyId: post.familyId,
      body,
      stickerKey: args.stickerKey,
      authorUserId: user._id,
      authorStudentId: studentId,
      createdAt: Date.now(),
    });

    const actorLabel = studentId
      ? ((await ctx.db.get("students", studentId))?.displayName ?? "Someone")
      : (user.name ?? "Someone");
    const isSelf =
      (studentId && post.actorStudentId === studentId) ||
      post.createdByUserId === user._id;
    if (!isSelf) {
      await notifyPostAuthor(ctx, post, {
        type: "feed_comment",
        title: `${actorLabel} commented`,
        body: body.slice(0, 120),
        createdBy: user._id,
      });
    }

    return id;
  },
});

export const updateComment = mutation({
  args: {
    commentId: v.id("feedComments"),
    body: v.string(),
    stickerKey: v.optional(v.string()),
  },
  returns: enrichedCommentValidator,
  handler: async (ctx, args) => {
    const comment = await ctx.db.get("feedComments", args.commentId);
    if (!comment || comment.deletedAt) throw new Error("Comment not found");
    const user = await requireFeedCircleAccess(ctx, comment.familyId);

    const isAuthor = comment.authorUserId === user._id;
    if (comment.authorStudentId) {
      const student = await ctx.db.get("students", comment.authorStudentId);
      if (student?.userId === user._id) {
        // ok
      } else if (!isAuthor) {
        throw new Error("Unauthorized: you can only edit your own comments");
      }
    } else if (!isAuthor) {
      throw new Error("Unauthorized: you can only edit your own comments");
    }

    if (args.stickerKey) {
      const sticker = await ctx.db
        .query("stickers")
        .withIndex("by_stickerKey", (q) => q.eq("stickerKey", args.stickerKey!))
        .unique();
      if (!sticker) throw new Error("Sticker not found");
    }

    await ctx.db.patch("feedComments", args.commentId, {
      body: normalizeCommentBody(args.body),
      stickerKey: args.stickerKey,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("feedComments", args.commentId);
    if (!updated) throw new Error("Failed to update comment");
    return await enrichComment(ctx, updated);
  },
});

export const removeComment = mutation({
  args: { commentId: v.id("feedComments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get("feedComments", args.commentId);
    if (!comment) throw new Error("Comment not found");
    const user = await requireFeedCircleAccess(ctx, comment.familyId);
    const membership = await getFamilyMembership(
      ctx,
      comment.familyId,
      user._id,
    );
    const isParent =
      user.role === "superAdmin" ||
      (membership !== null &&
        (user.role === "parent" ||
          membership.role === "parent" ||
          membership.role === "guardian"));

    let isAuthor = comment.authorUserId === user._id;
    if (comment.authorStudentId) {
      const student = await ctx.db.get("students", comment.authorStudentId);
      if (student?.userId === user._id) isAuthor = true;
    }

    if (!isAuthor && !isParent) {
      throw new Error("Unauthorized: you can only delete your own comments");
    }

    if (isParent && !isAuthor) {
      await ctx.db.patch("feedComments", args.commentId, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.delete("feedComments", args.commentId);
    }
    return null;
  },
});

// ── Re-cheer ───────────────────────────────────────────────────────────────

export const recheer = mutation({
  args: {
    postId: v.id("feedPosts"),
    note: v.optional(v.string()),
    asStudentId: v.optional(v.id("students")),
  },
  returns: v.id("feedPosts"),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("feedPosts", args.postId);
    if (!post) throw new Error("Post not found");
    const { user, studentId } = await viewerContext(
      ctx,
      post.familyId,
      args.asStudentId,
    );

    // One-level: if already a recheer, point at the root original.
    const rootId = post.originalPostId ?? post._id;
    const root = post.originalPostId
      ? await ctx.db.get("feedPosts", post.originalPostId)
      : post;
    if (!root) throw new Error("Original post not found");

    // Prevent duplicate re-cheer by same actor.
    const existing = await ctx.db
      .query("feedPosts")
      .withIndex("by_original", (q) => q.eq("originalPostId", rootId))
      .collect();
    for (const e of existing) {
      if (studentId && e.actorStudentId === studentId) {
        throw new Error("You already re-cheered this");
      }
      if (!studentId && e.createdByUserId === user._id && !e.actorStudentId) {
        throw new Error("You already re-cheered this");
      }
    }

    const actorLabel = studentId
      ? ((await ctx.db.get("students", studentId))?.displayName ?? "Someone")
      : (user.name ?? "Someone");

    const note = normalizeFeedBody(args.note);
    const postId = await createFeedPost(ctx, {
      familyId: post.familyId,
      type: "recheer",
      actorStudentId: studentId,
      title: note
        ? `${actorLabel} re-cheered`
        : `${actorLabel} re-cheered this`,
      body: note,
      href: "/family/cheers?tab=wall",
      createdByUserId: user._id,
      isRecheer: true,
      originalPostId: rootId,
    });

    const isSelf =
      (studentId && root.actorStudentId === studentId) ||
      root.createdByUserId === user._id;
    if (!isSelf) {
      await notifyPostAuthor(ctx, root, {
        type: "feed_recheer",
        title: `${actorLabel} re-cheered your post`,
        body: root.title.slice(0, 120),
        createdBy: user._id,
      });
    }

    return postId;
  },
});

// ── Cheer of the day + unread ──────────────────────────────────────────────

export const cheerOfTheDay = query({
  args: {
    familyId: v.id("families"),
    now: v.number(),
  },
  returns: v.union(enrichedFeedPostValidator, v.null()),
  handler: async (ctx, args) => {
    const { user, studentId } = await viewerContext(ctx, args.familyId);
    const dayAgo = args.now - 24 * 60 * 60 * 1000;
    const posts = await ctx.db
      .query("feedPosts")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .take(60);

    let best: Doc<"feedPosts"> | null = null;
    let bestScore = -1;
    for (const post of posts) {
      if (post.createdAt < dayAgo) continue;
      const reactions = await ctx.db
        .query("feedReactions")
        .withIndex("by_post", (q) => q.eq("postId", post._id))
        .collect();
      const comments = await ctx.db
        .query("feedComments")
        .withIndex("by_post", (q) => q.eq("postId", post._id))
        .collect();
      const score =
        reactions.length * 2 +
        comments.filter((c) => !c.deletedAt).length +
        (post.pinnedAt ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = post;
      }
    }
    if (!best || bestScore <= 0) return null;
    return await enrichFeedPost(ctx, best, {
      userId: user._id,
      studentId,
    });
  },
});

export const unreadCount = query({
  args: {
    familyId: v.id("families"),
    now: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await requireFeedCircleAccess(ctx, args.familyId);
    const read = await ctx.db
      .query("feedWallReads")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", user._id),
      )
      .unique();
    const since = read?.lastReadAt ?? 0;
    const posts = await ctx.db
      .query("feedPosts")
      .withIndex("by_family_and_createdAt", (q) =>
        q.eq("familyId", args.familyId),
      )
      .order("desc")
      .take(40);
    // `now` keeps the query deterministic for caching while bounding the window.
    const windowStart = Math.max(since, args.now - 14 * 24 * 60 * 60 * 1000);
    return posts.filter(
      (p) => p.createdAt > windowStart && p.createdByUserId !== user._id,
    ).length;
  },
});

export const markWallRead = mutation({
  args: {
    familyId: v.id("families"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireFeedCircleAccess(ctx, args.familyId);
    const existing = await ctx.db
      .query("feedWallReads")
      .withIndex("by_family_and_user", (q) =>
        q.eq("familyId", args.familyId).eq("userId", user._id),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("feedWallReads", existing._id, {
        lastReadAt: Date.now(),
      });
    } else {
      await ctx.db.insert("feedWallReads", {
        familyId: args.familyId,
        userId: user._id,
        lastReadAt: Date.now(),
      });
    }
    return null;
  },
});

/** Families a teacher can cheer with (active academy subscriptions). */
export const listTeacherCheerFamilies = query({
  args: {},
  returns: v.array(
    v.object({
      familyId: v.id("families"),
      familyName: v.string(),
      academyId: v.id("academies"),
      academyName: v.string(),
      students: v.array(
        v.object({
          _id: v.id("students"),
          displayName: v.string(),
          imageStorageId: v.optional(v.id("_storage")),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (me.role !== "teacher" && me.role !== "superAdmin") {
      return [];
    }

    const memberships = await ctx.db
      .query("academyMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();

    const out = [];
    for (const am of memberships) {
      const academy = await ctx.db.get("academies", am.academyId);
      if (!academy) continue;
      const subs = await ctx.db
        .query("familyAcademySubscriptions")
        .withIndex("by_academy", (q) => q.eq("academyId", am.academyId))
        .collect();
      for (const sub of subs) {
        if (sub.status !== "active") continue;
        const family = await ctx.db.get("families", sub.familyId);
        if (!family) continue;
        const students = await ctx.db
          .query("students")
          .withIndex("by_family", (q) => q.eq("familyId", family._id))
          .collect();
        out.push({
          familyId: family._id,
          familyName: family.name,
          academyId: academy._id,
          academyName: academy.name,
          students: students.map((s) => ({
            _id: s._id,
            displayName: s.displayName,
            imageStorageId: s.imageStorageId,
          })),
        });
      }
    }
    return out;
  },
});

/** Stickers available for wall composer / comments. */
export const listStickersForWall = query({
  args: { familyId: v.id("families") },
  returns: v.array(
    v.object({
      stickerKey: v.string(),
      label: v.string(),
      emoji: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireFeedCircleAccess(ctx, args.familyId);
    const stickers = await ctx.db.query("stickers").collect();
    return stickers
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 40)
      .map((s) => ({
        stickerKey: s.stickerKey,
        label: s.label,
        emoji: s.emoji,
      }));
  },
});
