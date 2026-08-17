"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { mockVocabExplain } from "./mocks";
import { chatCompletion, keywordFilter } from "./provider";
import {
  ageBandValidator,
  providerValidator,
  type AgeBand,
} from "./types";

function parseVocabJson(
  content: string,
): { definition: string; example: string } | null {
  try {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      definition?: unknown;
      example?: unknown;
    };
    if (
      typeof parsed.definition !== "string" ||
      typeof parsed.example !== "string"
    ) {
      return null;
    }
    const definition = parsed.definition.trim();
    const example = parsed.example.trim();
    if (!definition || !example) return null;
    return { definition, example };
  } catch {
    return null;
  }
}

/**
 * Capability: vocab_explain — one-word, age-fit definition for read-along.
 */
export const explain = action({
  args: {
    word: v.string(),
    ageBand: v.optional(ageBandValidator),
    parentGuardrailContext: v.optional(v.string()),
  },
  returns: v.object({
    word: v.string(),
    definition: v.string(),
    example: v.string(),
    provider: providerValidator,
    reason: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    word: string;
    definition: string;
    example: string;
    provider: "mock" | "openai" | "gateway";
    reason: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const word = args.word.trim();
    if (!word) throw new Error("Word is required");

    const ageBand: AgeBand = args.ageBand ?? "elementary";
    const guard =
      args.parentGuardrailContext?.trim() ||
      "Age-appropriate vocabulary only. No adult themes.";
    const { filteredTopics, blocked } = keywordFilter(word, guard);
    if (blocked) {
      return {
        word,
        definition:
          "That word is outside your family's reading guidelines. Pick another word from the story.",
        example: "Ask a parent if you want a different explanation.",
        provider: "mock",
        reason: `Blocked: ${filteredTopics.join(", ")}`,
      };
    }

    const mock = mockVocabExplain({ word, ageBand });
    let definition = mock.definition;
    let example = mock.example;
    let provider: "mock" | "openai" | "gateway" = "mock";
    let reason =
      "Vocab mock (set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)";

    const llm = await chatCompletion({
      system: `You explain ONE English word for a homeschool read-along.
Return ONLY JSON: {"definition":"...","example":"..."}
Age band: ${ageBand}.
Parent guardrails: ${guard}
Rules: one or two short sentences; kid-safe; no slang that needs adult themes; no medical claims.`,
      user: `Explain: ${word}`,
      temperature: 0.3,
    });

    if (llm) {
      const parsed = parseVocabJson(llm.content);
      if (parsed) {
        definition = parsed.definition;
        example = parsed.example;
        provider = llm.provider;
        reason = "Age-banded LLM definition";
      }
    }

    return { word, definition, example, provider, reason };
  },
});
