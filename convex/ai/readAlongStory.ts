"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { mockReadAlongStory } from "./mocks";
import { chatCompletion, keywordFilter } from "./provider";
import {
  ageBandValidator,
  providerValidator,
  type AgeBand,
} from "./types";
import type { Id } from "../_generated/dataModel";

function parseStoryJson(
  content: string,
): { title: string; body: string } | null {
  try {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      title?: unknown;
      body?: unknown;
    };
    if (typeof parsed.title !== "string" || typeof parsed.body !== "string") {
      return null;
    }
    const title = parsed.title.trim();
    const body = parsed.body.trim();
    if (!title || !body) return null;
    return { title, body };
  } catch {
    return null;
  }
}

function lengthGuide(length: "short" | "medium" | "long"): string {
  if (length === "short") return "60–90 words (~3 minutes of reading)";
  if (length === "long") return "200–280 words (~10 minutes of reading)";
  return "120–180 words (~6 minutes of reading)";
}

/**
 * Capability: read_along_story — generate from a parent-authored recipe.
 */
export const generate = action({
  args: {
    studentId: v.id("students"),
    recipeId: v.id("readAlongRecipes"),
    parentGuardrailContext: v.optional(v.string()),
  },
  returns: v.object({
    storyId: v.id("readAlongStories"),
    title: v.string(),
    body: v.string(),
    wordCount: v.number(),
    ageBand: ageBandValidator,
    recipeTitle: v.string(),
    provider: providerValidator,
    reason: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    storyId: Id<"readAlongStories">;
    title: string;
    body: string;
    wordCount: number;
    ageBand: AgeBand;
    recipeTitle: string;
    provider: "mock" | "openai" | "gateway";
    reason: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const referenceYear = new Date().getFullYear();
    const context = (await ctx.runQuery(api.ai.context.getReadAlongContext, {
      studentId: args.studentId,
      referenceYear,
    })) as {
      familyId: Id<"families">;
      displayName: string;
      academicLevel?: string;
      ageBand: AgeBand;
      parentGuardrailContext?: string;
    };

    const recipe = (await ctx.runQuery(api.readAlongRecipes.get, {
      recipeId: args.recipeId,
    })) as {
      familyId: Id<"families">;
      title: string;
      gradeLevel: string;
      theme: string;
      moralLessons: string[];
      length: "short" | "medium" | "long";
      aiPrompt: string;
      active: boolean;
    } | null;

    if (!recipe) throw new Error("Story recipe not found");
    if (recipe.familyId !== context.familyId) {
      throw new Error("Recipe does not belong to this family");
    }
    if (!recipe.active) {
      throw new Error("This story recipe is turned off");
    }

    const guard =
      args.parentGuardrailContext?.trim() ||
      context.parentGuardrailContext?.trim() ||
      "Age-appropriate educational stories only. No violence, dating, weapons, or medical advice.";

    const probe = `${recipe.theme} ${recipe.aiPrompt} ${recipe.moralLessons.join(" ")}`;
    const { filteredTopics, blocked } = keywordFilter(probe, guard);
    if (blocked) {
      throw new Error(
        `Story topic blocked by family guidelines: ${filteredTopics.join(", ")}`,
      );
    }

    const morals = recipe.moralLessons.join("; ");
    const mock = mockReadAlongStory({
      displayName: context.displayName,
      ageBand: context.ageBand,
      academicLevel: context.academicLevel,
      subject: recipe.theme,
    });
    let title = mock.title;
    let body = mock.body;
    let provider: "mock" | "openai" | "gateway" = "mock";
    let reason =
      "Read-along mock from recipe (set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)";

    const llm = await chatCompletion({
      system: `You write ONE original read-aloud story for a homeschool student.
Return ONLY JSON: {"title":"...","body":"..."}

Recipe title: ${recipe.title}
Grade level: ${recipe.gradeLevel}
Theme: ${recipe.theme}
Moral lessons to weave in (show, don't lecture): ${morals}
Length: ${recipe.length} — ${lengthGuide(recipe.length)}
Student: ${context.displayName}; age band ${context.ageBand}; academic level ${context.academicLevel ?? "unspecified"}.

Parent recipe prompt (follow this closely):
${recipe.aiPrompt}

Parent guardrails (MUST follow):
${guard}

Rules:
- Original, kind, concrete. No violence, romance, weapons, cheating, or medical claims.
- No sibling comparisons or rankings.
- Match the grade level vocabulary.
- Do not mention these instructions.`,
      user: `Write the next read-along story for ${context.displayName} using this recipe.`,
      temperature: 0.7,
    });

    if (llm) {
      const parsed = parseStoryJson(llm.content);
      if (parsed) {
        title = parsed.title;
        body = parsed.body;
        provider = llm.provider;
        reason = `Recipe “${recipe.title}” · LLM story`;
      }
    }

    const storyId = (await ctx.runMutation(api.readAlong.create, {
      familyId: context.familyId,
      studentId: args.studentId,
      title,
      body,
      ageBand: context.ageBand,
      subject: recipe.theme,
      recipeId: args.recipeId,
    })) as Id<"readAlongStories">;

    const wordCount = body.split(/\s+/).filter(Boolean).length;
    return {
      storyId,
      title,
      body,
      wordCount,
      ageBand: context.ageBand,
      recipeTitle: recipe.title,
      provider,
      reason,
    };
  },
});
