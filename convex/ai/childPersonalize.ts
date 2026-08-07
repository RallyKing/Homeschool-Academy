"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { mockChildRecommendations } from "./mocks";
import { chatCompletion } from "./provider";
import { providerValidator, recommendationItemValidator } from "./types";
import type { AgeBand } from "./types";

type PersonalizeResult = {
  provider: "mock" | "openai" | "gateway";
  studentName: string;
  ageBand: string;
  recommendations: Array<{
    area: string;
    title: string;
    detail: string;
    priority: "low" | "medium" | "high";
  }>;
  reason: string;
};

/**
 * Capability: child_personalize — per-student learning & development tips.
 */
export const personalize = action({
  args: {
    studentId: v.id("students"),
    parentGuardrailContext: v.optional(v.string()),
  },
  returns: v.object({
    provider: providerValidator,
    studentName: v.string(),
    ageBand: v.string(),
    recommendations: v.array(recommendationItemValidator),
    reason: v.string(),
  }),
  handler: async (ctx, args): Promise<PersonalizeResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const referenceYear = new Date().getFullYear();
    const stats = (await ctx.runQuery(api.ai.context.getBadgeCraftContext, {
      studentId: args.studentId,
      referenceYear,
    })) as {
      displayName: string;
      ageBand: AgeBand;
      academicLevel?: string;
      level: number;
      currentStreak: number;
      totalLogs: number;
      totalChoresCompleted: number;
      distinctSubjectsLogged: number;
    };

    const guard =
      args.parentGuardrailContext?.trim() ||
      "Age-appropriate developmental tips only. No medical claims. No competition.";

    let recommendations = mockChildRecommendations({
      displayName: stats.displayName,
      ageBand: stats.ageBand,
      academicLevel: stats.academicLevel,
      level: stats.level,
      distinctSubjects: stats.distinctSubjectsLogged,
      currentStreak: stats.currentStreak,
    });
    let provider: "mock" | "openai" | "gateway" = "mock";
    let reason =
      "Child personalize mock (set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)";

    const llm = await chatCompletion({
      system: `You personalize learning recommendations for ONE child.
Return ONLY JSON: {"recommendations":[{"area","title","detail","priority":"low"|"medium"|"high"}]}
Age band: ${stats.ageBand}. Academic level: ${stats.academicLevel ?? "unspecified"}.
Parent guardrails: ${guard}
Rules: 3–4 tips; encouraging; never rank vs siblings; never medical/clinical.`,
      user: JSON.stringify({
        name: stats.displayName,
        level: stats.level,
        streak: stats.currentStreak,
        logs: stats.totalLogs,
        subjects: stats.distinctSubjectsLogged,
        chores: stats.totalChoresCompleted,
      }),
    });

    if (llm) {
      try {
        const parsed = JSON.parse(llm.content) as {
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
            .slice(0, 4)
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
          reason = "Per-child recommendations from LLM";
        }
      } catch {
        // keep mock
      }
    }

    return {
      provider,
      studentName: stats.displayName,
      ageBand: stats.ageBand,
      recommendations,
      reason,
    };
  },
});
