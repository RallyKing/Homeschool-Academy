"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { mockFamilyRecommendations } from "./mocks";
import { chatCompletion } from "./provider";
import { providerValidator, recommendationItemValidator } from "./types";

/**
 * Capability: family_optimize — aggregate family tips (non-medical, non-competitive).
 */
export const analyze = action({
  args: {
    familyId: v.id("families"),
    parentGuardrailContext: v.optional(v.string()),
  },
  returns: v.object({
    provider: providerValidator,
    recommendations: v.array(recommendationItemValidator),
    summary: v.string(),
    reason: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    provider: "mock" | "openai" | "gateway";
    recommendations: Array<{
      area: string;
      title: string;
      detail: string;
      priority: "low" | "medium" | "high";
    }>;
    summary: string;
    reason: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const snap = (await ctx.runQuery(api.ai.context.getFamilyOptimizeContext, {
      familyId: args.familyId,
    })) as {
      familyName: string;
      studentCount: number;
      courseCount: number;
      openChores: number;
      totalLogs: number;
    };

    const guard =
      args.parentGuardrailContext?.trim() ||
      "Practical homeschool planning only. No medical diagnoses. No ranking children.";

    let recommendations = mockFamilyRecommendations({
      studentCount: snap.studentCount,
      courseCount: snap.courseCount,
      openChores: snap.openChores,
      totalLogs: snap.totalLogs,
    });
    let provider: "mock" | "openai" | "gateway" = "mock";
    let reason =
      "Family optimize mock (set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)";
    let summary = `${snap.familyName}: ${snap.studentCount} learners, ${snap.courseCount} courses, ${snap.openChores} open chores, ${snap.totalLogs} total logs.`;

    const llm = await chatCompletion({
      system: `You optimize a homeschool family's learning plan.
Return ONLY JSON: {"summary":string,"recommendations":[{"area","title","detail","priority":"low"|"medium"|"high"}]}
Rules:
- 3–5 recommendations max
- Areas: courses, schedule, logging, chores, balance, subjects
- ${guard}
- Never compare children competitively
- Never give medical/psychological diagnoses`,
      user: JSON.stringify(snap),
    });

    if (llm) {
      try {
        const parsed = JSON.parse(llm.content) as {
          summary?: string;
          recommendations?: Array<{
            area?: string;
            title?: string;
            detail?: string;
            priority?: string;
          }>;
        };
        const cleaned =
          parsed.recommendations
            ?.filter((r) => r.area && r.title && r.detail)
            .slice(0, 5)
            .map((r) => ({
              area: String(r.area),
              title: String(r.title).trim(),
              detail: String(r.detail).trim(),
              priority: (["low", "medium", "high"].includes(String(r.priority))
                ? r.priority
                : "medium") as "low" | "medium" | "high",
            })) ?? [];
        if (cleaned.length > 0) {
          recommendations = cleaned;
          provider = llm.provider;
          reason = "Family recommendations from LLM";
          if (parsed.summary) summary = parsed.summary.trim();
        }
      } catch {
        // keep mock
      }
    }

    return { provider, recommendations, summary, reason };
  },
});
