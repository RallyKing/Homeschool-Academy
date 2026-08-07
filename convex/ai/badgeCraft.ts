"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mockBadgeProposals } from "./mocks";
import type { StudentStatsSnapshot } from "./mocks";
import { chatCompletion } from "./provider";
import {
  badgeProposalShapeValidator,
  providerValidator,
} from "./types";
import type { AgeBand } from "./types";

type BadgeCraftResult = {
  provider: "mock" | "openai" | "gateway";
  ageBand: string;
  proposals: Array<{
    key: string;
    title: string;
    description: string;
    iconHint: string;
    criteriaSummary: string;
    ageBand: string;
  }>;
  proposalIds: Id<"badgeProposals">[];
  reason: string;
};

/**
 * Capability: badge_craft
 * Narrow: propose age-appropriate badges from stats only. Parent must accept.
 */
export const craft = action({
  args: {
    studentId: v.id("students"),
    parentGuardrailContext: v.optional(v.string()),
    persist: v.optional(v.boolean()),
  },
  returns: v.object({
    provider: providerValidator,
    ageBand: v.string(),
    proposals: v.array(badgeProposalShapeValidator),
    proposalIds: v.array(v.id("badgeProposals")),
    reason: v.string(),
  }),
  handler: async (ctx, args): Promise<BadgeCraftResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const referenceYear = new Date().getFullYear();
    const stats = (await ctx.runQuery(api.ai.context.getBadgeCraftContext, {
      studentId: args.studentId,
      referenceYear,
    })) as StudentStatsSnapshot & {
      existingBadgeTitles: string[];
      ageBand: AgeBand;
    };

    const guard = args.parentGuardrailContext?.trim() || "Age-appropriate only. Encouraging, non-competitive.";

    let proposals = mockBadgeProposals(stats);
    let provider: "mock" | "openai" | "gateway" = "mock";
    let reason =
      "Deterministic badge craft mock (set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)";

    const llm = await chatCompletion({
      temperature: 0.5,
      system: `You craft 2–4 custom learning badges for ONE homeschool student.
Return ONLY valid JSON: {"proposals":[{"key","title","description","iconHint","criteriaSummary","ageBand"}]}
Rules:
- Age band must match: ${stats.ageBand}
- Developmental level: ${stats.academicLevel ?? "unspecified"}
- Parent guardrails: ${guard}
- Fun, encouraging, NON-competitive (never rank vs siblings)
- Keys: snake_case, unique, prefix ai_
- iconHint: one of star, flame, book, sparkle, leaf, pencil
- criteriaSummary: short plain English
- Do not invent medical or clinical claims`,
      user: JSON.stringify({
        displayName: stats.displayName,
        level: stats.level,
        xp: stats.xp,
        streak: stats.currentStreak,
        logs: stats.totalLogs,
        chores: stats.totalChoresCompleted,
        minutes: stats.totalMinutesLogged,
        subjects: stats.distinctSubjectsLogged,
        existingBadges: stats.existingBadgeTitles,
      }),
    });

    if (llm) {
      try {
        const parsed = JSON.parse(llm.content) as {
          proposals?: Array<{
            key?: string;
            title?: string;
            description?: string;
            iconHint?: string;
            criteriaSummary?: string;
            ageBand?: string;
          }>;
        };
        const cleaned =
          parsed.proposals
            ?.filter((p) => p.key && p.title && p.description)
            .slice(0, 4)
            .map((p) => ({
              key: String(p.key).toLowerCase().replace(/\s+/g, "_"),
              title: String(p.title).trim(),
              description: String(p.description).trim(),
              iconHint: String(p.iconHint ?? "star").trim(),
              criteriaSummary: String(
                p.criteriaSummary ?? "Parent-approved custom badge",
              ).trim(),
              ageBand: String(p.ageBand ?? stats.ageBand),
            })) ?? [];
        if (cleaned.length > 0) {
          proposals = cleaned;
          provider = llm.provider;
          reason = "Badge proposals from LLM (parent must accept before grant)";
        }
      } catch {
        // keep mock proposals
      }
    }

    const proposalIds: Id<"badgeProposals">[] = [];
    const shouldPersist = args.persist !== false;
    if (shouldPersist) {
      for (const p of proposals) {
        const id = await ctx.runMutation(api.ai.badgeProposals.create, {
          studentId: args.studentId,
          key: p.key,
          title: p.title,
          description: p.description,
          iconHint: p.iconHint,
          criteriaSummary: p.criteriaSummary,
          ageBand: p.ageBand,
        });
        proposalIds.push(id);
      }
    }

    return {
      provider,
      ageBand: stats.ageBand,
      proposals,
      proposalIds,
      reason,
    };
  },
});
