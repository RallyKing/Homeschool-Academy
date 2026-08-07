import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { subjectCategoryValidator, subjectDocValidator } from "./lib/validators";

const SEED_SUBJECTS: Array<{
  name: string;
  category: "stem" | "humanities" | "life" | "applied";
}> = [
  { name: "Math", category: "stem" },
  { name: "Science", category: "stem" },
  { name: "AI/CS", category: "stem" },
  { name: "Reading", category: "humanities" },
  { name: "Art", category: "humanities" },
  { name: "Music", category: "humanities" },
  { name: "Executive Function/Ethics", category: "life" },
  { name: "Law/History", category: "life" },
  { name: "PE", category: "applied" },
  { name: "Entrepreneurship", category: "applied" },
];

export const list = query({
  args: {},
  returns: v.array(subjectDocValidator),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.db.query("subjects").collect();
  },
});

export const listByCategory = query({
  args: { category: subjectCategoryValidator },
  returns: v.array(subjectDocValidator),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    return await ctx.db
      .query("subjects")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

export const seed = mutation({
  args: {},
  returns: v.object({
    created: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const existingCount = (await ctx.db.query("subjects").take(1)).length;
    if (existingCount > 0 && user.role !== "superAdmin") {
      throw new Error("Subjects already seeded. SuperAdmin required to re-run.");
    }

    const now = Date.now();
    let created = 0;

    for (const subject of SEED_SUBJECTS) {
      const existing = await ctx.db
        .query("subjects")
        .withIndex("by_name", (q) => q.eq("name", subject.name))
        .unique();

      if (!existing) {
        await ctx.db.insert("subjects", {
          name: subject.name,
          category: subject.category,
          createdAt: now,
        });
        created += 1;
      }
    }

    return { created, total: SEED_SUBJECTS.length };
  },
});

export const seedInternal = internalMutation({
  args: {},
  returns: v.object({
    created: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let created = 0;

    for (const subject of SEED_SUBJECTS) {
      const existing = await ctx.db
        .query("subjects")
        .withIndex("by_name", (q) => q.eq("name", subject.name))
        .unique();

      if (!existing) {
        await ctx.db.insert("subjects", {
          name: subject.name,
          category: subject.category,
          createdAt: now,
        });
        created += 1;
      }
    }

    return { created, total: SEED_SUBJECTS.length };
  },
});
