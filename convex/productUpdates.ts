import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser, requireSuperAdmin } from "./lib/auth";
import { slugify } from "./lib/slugs";
import {
  knowledgeBaseArticleDocValidator,
  productUpdateDocValidator,
  publishStatusValidator,
} from "./lib/validators";

/**
 * Product upgrade pipeline:
 * - Prefer `createWithKnowledgeBase` / `publishUpgrade` so every upgrade also
 *   creates a linked knowledge base article.
 * - Set `status: "published"` (and publishedAt) for the item to appear on
 *   `/updates` and `/help`. Drafts stay admin-only.
 * - Re-run `seedPublishedFeatures` / `seedSample` is idempotent by KB slug.
 */

type FeatureSeed = {
  title: string;
  summary: string;
  body: string;
  version: string;
  slug: string;
  category: string;
};

const FEATURE_SEEDS: FeatureSeed[] = [
  {
    title: "Family Cheer Wall",
    summary:
      "A family-only wall that celebrates cheers, finished work, badges, and accolades — without rankings.",
    body: `The Family Wall brings Encouragement Circle into a shared feed everyone at home can see.

**Where to go**
- Parents: Life → Family wall (\`/family/cheers\`, Wall tab) or \`/family/feed\`
- Students: Life → Cheer → Wall (\`/student/social?tab=wall\`)

**What shows up**
- Public sibling cheers and stickers (opt-in when sending)
- Learning logs and finished chores
- Badges earned, level celebrations, and parent accolades

**Privacy**
- Family-only — never public internet, never competitive rankings
- Keep cheers private by unchecking “Celebrate on the family wall”`,
    version: "1.2.0",
    slug: "family-cheer-wall",
    category: "Family life",
  },
  {
    title: "Encouragement Circle & Cheer",
    summary:
      "Send cheers between family members and keep encouragement flowing in the Circle.",
    body: `Family Cheers lets parents and students celebrate wins together.

**Where to go**
- Parents: Account → Life → Family wall (\`/family/cheers\`)
- Students: Life → Cheer (\`/student/social\`)

**What you can do**
- Post encouragement tied to a student
- Browse the family encouragement feed
- Keep momentum visible alongside chores and learning`,
    version: "1.1.0",
    slug: "encouragement-circle-cheer",
    category: "Family life",
  },
  {
    title: "Gamification, chores & rewards",
    summary:
      "Points, streaks, badges, chores, and family rewards in one economy.",
    body: `Homeschool Academy now includes a deep gamification layer connected to family chores.

**Where to go**
- Parents: Life → Chores & rewards (\`/family/chores\`)
- Students: Chores (\`/student/chores\`)

**Highlights**
- Assign and complete chores
- Earn points and track streaks
- Redeem or manage family rewards
- Badge progress that ties learning and life together`,
    version: "1.2.0",
    slug: "gamification-chores-rewards",
    category: "Family life",
  },
  {
    title: "Student Control Center & family log CRUD",
    summary:
      "Parents fully manage student profiles and edit or clear learning ledger entries.",
    body: `Parents have full control of student profile content and the family learning ledger.

**Where to go**
- Family dashboard student management (\`/family/dashboard\`)
- Learning ledger (\`/family/ledger\`)

**What you can do**
- Create, edit, and manage student profile content
- Add, edit, and nullify/clear log entries
- Keep the academic record accurate without leaving the family workspace`,
    version: "1.3.0",
    slug: "student-control-center-family-log-crud",
    category: "Learning",
  },
  {
    title: "Modular family AI",
    summary:
      "Capability-based AI tools for families — insights and badge craft with clear mock-first status.",
    body: `The Family AI hub exposes modular capabilities instead of a single opaque chat.

**Where to go**
- Learn → AI (\`/family/ai\`)

**What you can do**
- Browse registered AI capabilities
- Run insights and badge-craft flows
- See which tools are live vs mock-first so expectations stay clear`,
    version: "1.4.0",
    slug: "modular-family-ai",
    category: "AI",
  },
  {
    title: "Progress charts",
    summary:
      "Visual progress for subjects, courses, and learning activity over time.",
    body: `Progress views help families see how learning is trending.

**Where to go**
- Learn → Progress (\`/family/progress\`)

**What you can do**
- Review charts for recent activity
- Spot gaps across subjects and courses
- Use progress alongside the planner and ledger`,
    version: "1.5.0",
    slug: "progress-charts",
    category: "Learning",
  },
  {
    title: "Install as an app (PWA)",
    summary:
      "Add Homeschool Academy to your home screen for a faster, app-like experience.",
    body: `Homeschool Academy can be installed as a Progressive Web App.

**How**
- Use the Install control in the top navigation when your browser offers it
- Or use your browser’s “Add to Home Screen” / “Install app” option

**Why**
- Quicker launch on phones and tablets
- A focused window without browser chrome
- Same signed-in family experience`,
    version: "1.6.0",
    slug: "pwa-install",
    category: "Platform",
  },
  {
    title: "What's new & knowledge base",
    summary:
      "Product updates and Help articles stay linked — publish an upgrade once, read it in both places.",
    body: `Every published product upgrade can land in two places:

1. **What's new** (\`/updates\`) — the product feed
2. **Knowledge base** (\`/help\`) — durable how-to articles

**For families**
- Account → What's new
- Account → Help / Knowledge base

**For SuperAdmins**
- Admin → Manage updates / Manage KB
- Creating an upgrade with \`createWithKnowledgeBase\` always creates the linked article
- Only **published** items appear on the public feeds; drafts stay admin-only`,
    version: "1.7.0",
    slug: "whats-new-and-knowledge-base",
    category: "Platform",
  },
  {
    title: "Read-along stories",
    summary:
      "Students read generated stories with word highlighting, click-to-hear, microphone checking, vocabulary, and a practice round for missed words.",
    body: `Read-along is a student activity parents control with **story recipes**.

**Where to go**
- Parents: Learn → Read-along (\`/family/read-along\`), Story recipes tab — or a student’s Read tab
- Students: Today → Read, or \`/student/read-along\`
- SuperAdmin: Admin → Read-along (pick a school)

**Story recipes**
Parents fill a form: title, grade level, theme, moral lessons, length, and the **AI prompt** that generates stories. Students pick a recipe, then generate. No recipe, no generated story (starter recipes can be added).

**How reading works**
1. The current word highlights in teal. Tap any word to hear it (browser text-to-speech).
2. In Chrome or Edge, the microphone checks that the child said the current word (fuzzy match). Safari can tap Next and still use tap-to-hear.
3. A miss pauses for one retry. A second miss plays the word aloud, marks it for help, and continues.
4. After the story, practice missed words, then finish. Time is logged as a learning session. Correct words earn small points (1 per 5 words).

**Privacy**
- Chrome/Edge speech recognition uses the browser’s speech service. Audio is not stored in Homeschool Academy.
- Stories and session stats stay in the family.`,
    version: "1.8.0",
    slug: "read-along-stories",
    category: "Learning",
  },
];

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

async function resolveSeedAuthor(
  ctx: MutationCtx,
): Promise<Id<"users">> {
  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
    .take(1);
  if (superAdmins[0]) return superAdmins[0]._id;

  const owner = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", "JoshuaEBallard@gmail.com"))
    .unique();
  if (owner) {
    await ctx.db.patch("users", owner._id, { role: "superAdmin" });
    return owner._id;
  }

  const anyUser = await ctx.db.query("users").take(1);
  if (!anyUser[0]) {
    throw new Error("No users available to attribute seeded updates");
  }
  await ctx.db.patch("users", anyUser[0]._id, { role: "superAdmin" });
  return anyUser[0]._id;
}

async function seedFeatureUpdates(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{
  created: number;
  skipped: number;
  total: number;
  productUpdateIds: Id<"productUpdates">[];
  knowledgeBaseArticleIds: Id<"knowledgeBaseArticles">[];
}> {
  let created = 0;
  let skipped = 0;
  const productUpdateIds: Id<"productUpdates">[] = [];
  const knowledgeBaseArticleIds: Id<"knowledgeBaseArticles">[] = [];

  for (const feature of FEATURE_SEEDS) {
    const existing = await ctx.db
      .query("knowledgeBaseArticles")
      .withIndex("by_slug", (q) => q.eq("slug", feature.slug))
      .unique();
    if (existing) {
      skipped += 1;
      if (existing.productUpdateId) {
        productUpdateIds.push(existing.productUpdateId);
      }
      knowledgeBaseArticleIds.push(existing._id);
      continue;
    }

    const result = await insertUpgradeWithKb(ctx, userId, {
      title: feature.title,
      summary: feature.summary,
      body: feature.body,
      version: feature.version,
      status: "published",
      category: feature.category,
      slug: feature.slug,
    });
    created += 1;
    productUpdateIds.push(result.productUpdateId);
    knowledgeBaseArticleIds.push(result.knowledgeBaseArticleId);
  }

  return {
    created,
    skipped,
    total: FEATURE_SEEDS.length,
    productUpdateIds,
    knowledgeBaseArticleIds,
  };
}

/** SuperAdmin UI / client: seed all major feature updates as published. */
export const seedSample = mutation({
  args: {},
  returns: v.object({
    created: v.number(),
    skipped: v.number(),
    total: v.number(),
    productUpdateIds: v.array(v.id("productUpdates")),
    knowledgeBaseArticleIds: v.array(v.id("knowledgeBaseArticles")),
  }),
  handler: async (ctx) => {
    const user = await requireSuperAdmin(ctx);
    return await seedFeatureUpdates(ctx, user._id);
  },
});

/** CLI / deploy: `npx convex run productUpdates:seedPublishedFeatures --prod` */
export const seedPublishedFeatures = internalMutation({
  args: {},
  returns: v.object({
    created: v.number(),
    skipped: v.number(),
    total: v.number(),
    productUpdateIds: v.array(v.id("productUpdates")),
    knowledgeBaseArticleIds: v.array(v.id("knowledgeBaseArticles")),
    authorUserId: v.id("users"),
  }),
  handler: async (ctx) => {
    const authorUserId = await resolveSeedAuthor(ctx);
    const result = await seedFeatureUpdates(ctx, authorUserId);
    return { ...result, authorUserId };
  },
});
