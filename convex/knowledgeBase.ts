import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getCurrentUser, requireSuperAdmin } from "./lib/auth";
import { slugify } from "./lib/slugs";
import {
  knowledgeBaseArticleDocValidator,
  publishStatusValidator,
} from "./lib/validators";

async function uniqueSlug(
  ctx: MutationCtx,
  base: string,
  excludeId?: string,
): Promise<string> {
  const slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await ctx.db
      .query("knowledgeBaseArticles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();
    if (!existing || existing._id === excludeId) return candidate;
    attempt += 1;
  }
}

export const list = query({
  args: {
    status: v.optional(publishStatusValidator),
    category: v.optional(v.string()),
  },
  returns: v.array(knowledgeBaseArticleDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    let articles;
    if (args.category) {
      articles = await ctx.db
        .query("knowledgeBaseArticles")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(200);
    } else if (args.status) {
      if (args.status === "draft" && user.role !== "superAdmin") {
        throw new Error("Unauthorized: only SuperAdmin can list drafts");
      }
      articles = await ctx.db
        .query("knowledgeBaseArticles")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(200);
    } else if (user.role === "superAdmin") {
      articles = await ctx.db.query("knowledgeBaseArticles").take(200);
    } else {
      articles = await ctx.db
        .query("knowledgeBaseArticles")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .take(200);
    }

    if (user.role !== "superAdmin") {
      return articles.filter((a) => a.status === "published");
    }
    if (args.status && args.category) {
      return articles.filter((a) => a.status === args.status);
    }
    return articles;
  },
});

export const listPublished = query({
  args: {},
  returns: v.array(knowledgeBaseArticleDocValidator),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.db
      .query("knowledgeBaseArticles")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(200);
  },
});

export const get = query({
  args: { articleId: v.id("knowledgeBaseArticles") },
  returns: v.union(knowledgeBaseArticleDocValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db.get("knowledgeBaseArticles", args.articleId);
    if (!doc) return null;
    if (doc.status !== "published" && user.role !== "superAdmin") {
      throw new Error("Unauthorized: draft articles are admin-only");
    }
    return doc;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(knowledgeBaseArticleDocValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db
      .query("knowledgeBaseArticles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!doc) return null;
    if (doc.status !== "published" && user.role !== "superAdmin") {
      throw new Error("Unauthorized: draft articles are admin-only");
    }
    return doc;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    status: publishStatusValidator,
    productUpdateId: v.optional(v.id("productUpdates")),
  },
  returns: v.id("knowledgeBaseArticles"),
  handler: async (ctx, args) => {
    const user = await requireSuperAdmin(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Title is required");
    if (!body) throw new Error("Body is required");

    if (args.productUpdateId) {
      const update = await ctx.db.get("productUpdates", args.productUpdateId);
      if (!update) throw new Error("Product update not found");
    }

    const slug = args.slug?.trim()
      ? await uniqueSlug(ctx, args.slug)
      : await uniqueSlug(ctx, title);

    const now = Date.now();
    const articleId = await ctx.db.insert("knowledgeBaseArticles", {
      title,
      slug,
      body,
      category: args.category?.trim() || undefined,
      productUpdateId: args.productUpdateId,
      status: args.status,
      createdBy: user._id,
      createdAt: now,
    });

    if (args.productUpdateId) {
      await ctx.db.patch("productUpdates", args.productUpdateId, {
        knowledgeBaseArticleId: articleId,
        updatedAt: now,
      });
    }

    return articleId;
  },
});

export const update = mutation({
  args: {
    articleId: v.id("knowledgeBaseArticles"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(publishStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db.get("knowledgeBaseArticles", args.articleId);
    if (!existing) throw new Error("Knowledge base article not found");

    const patch: {
      title?: string;
      body?: string;
      slug?: string;
      category?: string;
      status?: "draft" | "published";
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.body !== undefined) {
      const body = args.body.trim();
      if (!body) throw new Error("Body is required");
      patch.body = body;
    }
    if (args.slug !== undefined) {
      const slug = await uniqueSlug(ctx, args.slug, args.articleId);
      patch.slug = slug;
    }
    if (args.category !== undefined) {
      patch.category = args.category.trim() || undefined;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }

    await ctx.db.patch("knowledgeBaseArticles", args.articleId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { articleId: v.id("knowledgeBaseArticles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db.get("knowledgeBaseArticles", args.articleId);
    if (!existing) throw new Error("Knowledge base article not found");

    if (existing.productUpdateId) {
      const update = await ctx.db.get("productUpdates", existing.productUpdateId);
      if (
        update &&
        update.knowledgeBaseArticleId === args.articleId
      ) {
        await ctx.db.patch("productUpdates", existing.productUpdateId, {
          knowledgeBaseArticleId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete("knowledgeBaseArticles", args.articleId);
    return null;
  },
});
