import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getCurrentUser,
  getFamilyMembership,
  requireFamilyAccess,
  requireParentOrSchoolAdmin,
  requireStudentFamilyAccess,
} from "./lib/auth";
import {
  readAlongLengthValidator,
  readAlongRecipeDocValidator,
} from "./lib/validators";

const RECIPE_LIST_LIMIT = 80;

export function parseMoralLessons(raw: string[] | string): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(/[\n,;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const lesson = part.trim();
    if (!lesson) continue;
    const key = lesson.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lesson.slice(0, 160));
    if (out.length >= 12) break;
  }
  return out;
}

export function lengthTargets(length: "short" | "medium" | "long"): {
  words: string;
  minutes: number;
} {
  if (length === "short") return { words: "60–90", minutes: 3 };
  if (length === "long") return { words: "200–280", minutes: 10 };
  return { words: "120–180", minutes: 6 };
}

const DEFAULT_RECIPES: Array<{
  title: string;
  gradeLevel: string;
  theme: string;
  moralLessons: string[];
  length: "short" | "medium" | "long";
  aiPrompt: string;
}> = [
  {
    title: "Kindness at home",
    gradeLevel: "K-2",
    theme: "Everyday kindness",
    moralLessons: ["Notice who needs help", "Choose a kind action"],
    length: "short",
    aiPrompt:
      "Write a gentle read-aloud about a child who notices someone at home who needs help and chooses one kind, concrete action. Use short sentences and common words. End with the kind choice, not a lecture.",
  },
  {
    title: "Stick with a hard problem",
    gradeLevel: "5-8",
    theme: "Persistence",
    moralLessons: ["Try a new approach", "Ask for help without giving up"],
    length: "medium",
    aiPrompt:
      "Write a realistic homeschool story about a student who gets stuck, tries a new approach, and finishes. No sibling comparisons or rankings. Keep the details specific and encouraging.",
  },
];

async function requireRecipeFamilyAccess(
  ctx: Parameters<typeof getCurrentUser>[0],
  familyId: Id<"families">,
  studentId?: Id<"students">,
) {
  if (studentId) {
    const { student } = await requireStudentFamilyAccess(ctx, studentId);
    if (student.familyId !== familyId) {
      throw new Error("Student is not in this family");
    }
    return;
  }
  const user = await getCurrentUser(ctx);
  if (user.role === "superAdmin") return;
  const membership = await getFamilyMembership(ctx, familyId, user._id);
  if (membership) return;
  const linked = await ctx.db
    .query("students")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (linked && linked.familyId === familyId) return;
  throw new Error("Unauthorized: no access to these recipes");
}

export const create = mutation({
  args: {
    familyId: v.id("families"),
    title: v.string(),
    gradeLevel: v.string(),
    theme: v.string(),
    moralLessons: v.array(v.string()),
    length: readAlongLengthValidator,
    aiPrompt: v.string(),
    active: v.optional(v.boolean()),
  },
  returns: v.id("readAlongRecipes"),
  handler: async (ctx, args) => {
    const { user } = await requireParentOrSchoolAdmin(ctx, args.familyId);
    const title = args.title.trim();
    const gradeLevel = args.gradeLevel.trim();
    const theme = args.theme.trim();
    const aiPrompt = args.aiPrompt.trim();
    if (!title) throw new Error("Title is required");
    if (!gradeLevel) throw new Error("Grade level is required");
    if (!theme) throw new Error("Theme is required");
    if (aiPrompt.length < 20) {
      throw new Error("AI prompt must be at least 20 characters");
    }
    const moralLessons = parseMoralLessons(args.moralLessons);
    if (moralLessons.length === 0) {
      throw new Error("Add at least one moral lesson");
    }

    return await ctx.db.insert("readAlongRecipes", {
      familyId: args.familyId,
      title,
      gradeLevel,
      theme,
      moralLessons,
      length: args.length,
      aiPrompt,
      active: args.active ?? true,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const listForFamily = query({
  args: {
    familyId: v.id("families"),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(readAlongRecipeDocValidator),
  handler: async (ctx, args) => {
    await requireFamilyAccess(ctx, args.familyId);
    const rows = await ctx.db
      .query("readAlongRecipes")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .take(RECIPE_LIST_LIMIT);
    const filtered = args.activeOnly
      ? rows.filter((r) => r.active)
      : rows;
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listActiveForStudent = query({
  args: { studentId: v.id("students") },
  returns: v.array(readAlongRecipeDocValidator),
  handler: async (ctx, args) => {
    const { student } = await requireStudentFamilyAccess(ctx, args.studentId);
    const rows = await ctx.db
      .query("readAlongRecipes")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", student.familyId).eq("active", true),
      )
      .take(RECIPE_LIST_LIMIT);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { recipeId: v.id("readAlongRecipes") },
  returns: v.union(readAlongRecipeDocValidator, v.null()),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get("readAlongRecipes", args.recipeId);
    if (!recipe) return null;
    await requireRecipeFamilyAccess(ctx, recipe.familyId);
    return recipe;
  },
});

export const update = mutation({
  args: {
    recipeId: v.id("readAlongRecipes"),
    title: v.optional(v.string()),
    gradeLevel: v.optional(v.string()),
    theme: v.optional(v.string()),
    moralLessons: v.optional(v.array(v.string())),
    length: v.optional(readAlongLengthValidator),
    aiPrompt: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get("readAlongRecipes", args.recipeId);
    if (!recipe) throw new Error("Recipe not found");
    await requireParentOrSchoolAdmin(ctx, recipe.familyId);

    const patch: {
      title?: string;
      gradeLevel?: string;
      theme?: string;
      moralLessons?: string[];
      length?: "short" | "medium" | "long";
      aiPrompt?: string;
      active?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required");
      patch.title = title;
    }
    if (args.gradeLevel !== undefined) {
      const gradeLevel = args.gradeLevel.trim();
      if (!gradeLevel) throw new Error("Grade level is required");
      patch.gradeLevel = gradeLevel;
    }
    if (args.theme !== undefined) {
      const theme = args.theme.trim();
      if (!theme) throw new Error("Theme is required");
      patch.theme = theme;
    }
    if (args.moralLessons !== undefined) {
      const moralLessons = parseMoralLessons(args.moralLessons);
      if (moralLessons.length === 0) {
        throw new Error("Add at least one moral lesson");
      }
      patch.moralLessons = moralLessons;
    }
    if (args.length !== undefined) patch.length = args.length;
    if (args.aiPrompt !== undefined) {
      const aiPrompt = args.aiPrompt.trim();
      if (aiPrompt.length < 20) {
        throw new Error("AI prompt must be at least 20 characters");
      }
      patch.aiPrompt = aiPrompt;
    }
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch("readAlongRecipes", args.recipeId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { recipeId: v.id("readAlongRecipes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get("readAlongRecipes", args.recipeId);
    if (!recipe) throw new Error("Recipe not found");
    await requireParentOrSchoolAdmin(ctx, recipe.familyId);
    await ctx.db.delete("readAlongRecipes", args.recipeId);
    return null;
  },
});

export const ensureDefaults = mutation({
  args: { familyId: v.id("families") },
  returns: v.array(v.id("readAlongRecipes")),
  handler: async (ctx, args) => {
    const { user } = await requireParentOrSchoolAdmin(ctx, args.familyId);
    const existing = await ctx.db
      .query("readAlongRecipes")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .take(RECIPE_LIST_LIMIT);
    if (existing.length > 0) {
      return existing.map((r) => r._id);
    }
    const ids: Id<"readAlongRecipes">[] = [];
    for (const recipe of DEFAULT_RECIPES) {
      const id = await ctx.db.insert("readAlongRecipes", {
        familyId: args.familyId,
        title: recipe.title,
        gradeLevel: recipe.gradeLevel,
        theme: recipe.theme,
        moralLessons: recipe.moralLessons,
        length: recipe.length,
        aiPrompt: recipe.aiPrompt,
        active: true,
        createdBy: user._id,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});
