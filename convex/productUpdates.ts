import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser, requireSuperAdmin } from "./lib/auth";
import { slugify } from "./lib/slugs";
import {
  knowledgeBaseArticleDocValidator,
  productUpdateDocValidator,
  publishStatusValidator,
} from "./lib/validators";

function buildKbBody(args: {
  title: string;
  summary: string;
  body: string;
  version?: string;
}): string {
  const versionLine = args.version ? `\n\n**Version:** ${args.version}` : "";
  return `# ${args.title}\n\n${args.summary}${versionLine}\n\n---\n\n${args.body}`;
}

async function uniqueSlug(ctx: MutationCtx, base: string): Promise<string> {
  const slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await ctx.db
      .query("knowledgeBaseArticles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();
    if (!existing) return candidate;
    attempt += 1;
  }
}

async function insertUpgradeWithKb(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    title: string;
    summary: string;
    body: string;
    version?: string;
    status: "draft" | "published";
    category?: string;
    slug?: string;
  },
): Promise<{
  productUpdateId: Id<"productUpdates">;
  knowledgeBaseArticleId: Id<"knowledgeBaseArticles">;
}> {
  const title = args.title.trim();
  const summary = args.summary.trim();
  const body = args.body.trim();
  if (!title) throw new Error("Title is required");
  if (!summary) throw new Error("Summary is required");
  if (!body) throw new Error("Body is required");

  const now = Date.now();
  const productUpdateId = await ctx.db.insert("productUpdates", {
    title,
    summary,
    body,
    version: args.version?.trim() || undefined,
    status: args.status,
    createdBy: userId,
    createdAt: now,
    publishedAt: args.status === "published" ? now : undefined,
  });

  const slug = args.slug?.trim()
    ? await uniqueSlug(ctx, args.slug)
    : await uniqueSlug(ctx, title);

  const knowledgeBaseArticleId = await ctx.db.insert("knowledgeBaseArticles", {
    title,
    slug,
    body: buildKbBody({
      title,
      summary,
      body,
      version: args.version?.trim(),
    }),
    category: args.category?.trim() || "Product updates",
    productUpdateId,
    status: args.status,
    createdBy: userId,
    createdAt: now,
  });

  await ctx.db.patch("productUpdates", productUpdateId, {
    knowledgeBaseArticleId,
  });

  return { productUpdateId, knowledgeBaseArticleId };
}

export const list = query({
  args: {
    status: v.optional(publishStatusValidator),
  },
  returns: v.array(productUpdateDocValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (args.status) {
      if (args.status === "draft" && user.role !== "superAdmin") {
        throw new Error("Unauthorized: only SuperAdmin can list drafts");
      }
      return await ctx.db
        .query("productUpdates")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(200);
    }
    if (user.role === "superAdmin") {
      return await ctx.db.query("productUpdates").take(200);
    }
    return await ctx.db
      .query("productUpdates")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(200);
  },
});

export const listPublished = query({
  args: {
    now: v.number(),
    since: v.optional(v.number()),
  },
  returns: v.array(productUpdateDocValidator),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    const published = await ctx.db
      .query("productUpdates")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(200);

    const filtered = published.filter((u) => {
      const at = u.publishedAt ?? u.createdAt;
      if (at > args.now) return false;
      if (args.since !== undefined && at <= args.since) return false;
      return true;
    });

    filtered.sort(
      (a, b) =>
        (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt),
    );
    return filtered;
  },
});

export const get = query({
  args: { productUpdateId: v.id("productUpdates") },
  returns: v.union(productUpdateDocValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const doc = await ctx.db.get("productUpdates", args.productUpdateId);
    if (!doc) return null;
    if (doc.status !== "published" && user.role !== "superAdmin") {
      throw new Error("Unauthorized: draft updates are admin-only");
    }
    return doc;
  },
});

export const getWithArticle = query({
  args: { productUpdateId: v.id("productUpdates") },
  returns: v.union(
    v.object({
      update: productUpdateDocValidator,
      article: v.union(knowledgeBaseArticleDocValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const update = await ctx.db.get("productUpdates", args.productUpdateId);
    if (!update) return null;
    if (update.status !== "published" && user.role !== "superAdmin") {
      throw new Error("Unauthorized: draft updates are admin-only");
    }
    let article = null;
    if (update.knowledgeBaseArticleId) {
      article = await ctx.db.get(
        "knowledgeBaseArticles",
        update.knowledgeBaseArticleId,
      );
    }
    return { update, article };
  },
});

/**
 * Atomic create: product update + linked knowledge base article.
 * Creating an upgrade MUST always produce both entries.
 */
export const createWithKnowledgeBase = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    version: v.optional(v.string()),
    status: publishStatusValidator,
    category: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.object({
    productUpdateId: v.id("productUpdates"),
    knowledgeBaseArticleId: v.id("knowledgeBaseArticles"),
  }),
  handler: async (ctx, args) => {
    const user = await requireSuperAdmin(ctx);
    return await insertUpgradeWithKb(ctx, user._id, args);
  },
});

/** Alias matching the product intent name. */
export const publishUpgrade = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    version: v.optional(v.string()),
    status: publishStatusValidator,
    category: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.object({
    productUpdateId: v.id("productUpdates"),
    knowledgeBaseArticleId: v.id("knowledgeBaseArticles"),
  }),
  handler: async (ctx, args) => {
    const user = await requireSuperAdmin(ctx);
    return await insertUpgradeWithKb(ctx, user._id, args);
  },
});

/** Independent create still always produces a linked KB article. */
export const create = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    body: v.string(),
    version: v.optional(v.string()),
    status: publishStatusValidator,
  },
  returns: v.id("productUpdates"),
  handler: async (ctx, args) => {
    const user = await requireSuperAdmin(ctx);
    const result = await insertUpgradeWithKb(ctx, user._id, {
      ...args,
      category: "Product updates",
    });
    return result.productUpdateId;
  },
});

export const update = mutation({
  args: {
    productUpdateId: v.id("productUpdates"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    body: v.optional(v.string()),
    version: v.optional(v.string()),
    status: v.optional(publishStatusValidator),
    syncKnowledgeBase: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db.get("productUpdates", args.productUpdateId);
    if (!existing) throw new Error("Product update not found");

    const now = Date.now();
    const patch: {
      title?: string;
      summary?: string;
      body?: string;
      version?: string;
      status?: "draft" | "published";
      updatedAt: number;
      publishedAt?: number;
    } = { updatedAt: now };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.summary !== undefined) {
      const summary = args.summary.trim();
      if (!summary) throw new Error("Summary is required");
      patch.summary = summary;
    }
    if (args.body !== undefined) {
      const body = args.body.trim();
      if (!body) throw new Error("Body is required");
      patch.body = body;
    }
    if (args.version !== undefined) {
      patch.version = args.version.trim() || undefined;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "published" && !existing.publishedAt) {
        patch.publishedAt = now;
      }
    }

    await ctx.db.patch("productUpdates", args.productUpdateId, patch);

    const shouldSync = args.syncKnowledgeBase !== false;
    if (shouldSync && existing.knowledgeBaseArticleId) {
      const article = await ctx.db.get(
        "knowledgeBaseArticles",
        existing.knowledgeBaseArticleId,
      );
      if (article) {
        const nextTitle = patch.title ?? existing.title;
        const nextSummary = patch.summary ?? existing.summary;
        const nextBody = patch.body ?? existing.body;
        const nextVersion =
          patch.version !== undefined ? patch.version : existing.version;
        const nextStatus = patch.status ?? existing.status;
        const day = new Date(now).toISOString().slice(0, 10);
        const revisionNote = `\n\n---\n\n_Updated ${day}._`;

        await ctx.db.patch(
          "knowledgeBaseArticles",
          existing.knowledgeBaseArticleId,
          {
            title: nextTitle,
            body:
              buildKbBody({
                title: nextTitle,
                summary: nextSummary,
                body: nextBody,
                version: nextVersion,
              }) + revisionNote,
            status: nextStatus,
            updatedAt: now,
          },
        );
      }
    }

    return null;
  },
});

export const remove = mutation({
  args: {
    productUpdateId: v.id("productUpdates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db.get("productUpdates", args.productUpdateId);
    if (!existing) throw new Error("Product update not found");

    // Cascade delete linked draft KB; unlink if published separately.
    if (existing.knowledgeBaseArticleId) {
      const article = await ctx.db.get(
        "knowledgeBaseArticles",
        existing.knowledgeBaseArticleId,
      );
      if (article) {
        if (article.status === "draft") {
          await ctx.db.delete(
            "knowledgeBaseArticles",
            existing.knowledgeBaseArticleId,
          );
        } else {
          await ctx.db.patch(
            "knowledgeBaseArticles",
            existing.knowledgeBaseArticleId,
            {
              productUpdateId: undefined,
              updatedAt: Date.now(),
            },
          );
        }
      }
    }

    await ctx.db.delete("productUpdates", args.productUpdateId);
    return null;
  },
});

export const seedSample = mutation({
  args: {},
  returns: v.object({
    created: v.boolean(),
    productUpdateId: v.optional(v.id("productUpdates")),
    knowledgeBaseArticleId: v.optional(v.id("knowledgeBaseArticles")),
  }),
  handler: async (ctx) => {
    const user = await requireSuperAdmin(ctx);

    const existing = await ctx.db
      .query("productUpdates")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(1);
    if (existing.length > 0) {
      return { created: false };
    }

    return {
      created: true,
      ...(await insertUpgradeWithKb(ctx, user._id, {
        title: "Welcome to product updates",
        summary:
          "Track platform upgrades here. Each upgrade also lands in the Help knowledge base.",
        body: "Homeschool Academy now ships a product update feed and a linked knowledge base. When SuperAdmins publish an upgrade, both surfaces stay in sync.",
        version: "0.2.0",
        status: "published",
        category: "Product updates",
      })),
    };
  },
});
