"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { DEFINITION_UNAVAILABLE } from "../lib/dictionaryCore";
import {
  ageBandValidator,
  providerValidator,
} from "./types";

/**
 * Capability: vocab_explain — dictionary definition for one read-along word.
 * Looks up Merriam-Webster when a key is set, otherwise dictionaryapi.dev.
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

    const looked = await ctx.runAction(api.dictionary.lookup, { word });
    const unavailable = looked.source === "unavailable" || !looked.definition;
    return {
      word: looked.word || word,
      definition: looked.definition ?? DEFINITION_UNAVAILABLE,
      example: looked.example ?? "",
      provider: "mock",
      reason: unavailable
        ? DEFINITION_UNAVAILABLE
        : `Dictionary (${looked.source})`,
    };
  },
});
