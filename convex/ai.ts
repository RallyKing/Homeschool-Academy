"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Mock AI guardrails: demonstrates parent-approved educational filtering.
 * Replace with a real LLM provider later; keep the same contract.
 */
export const filterPrompt = action({
  args: {
    studentPrompt: v.string(),
    parentGuardrailContext: v.string(),
  },
  returns: v.object({
    allowed: v.boolean(),
    response: v.string(),
    filteredTopics: v.array(v.string()),
    reason: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const prompt = args.studentPrompt.toLowerCase();
    const guardrails = args.parentGuardrailContext.toLowerCase();

    const blockedKeywords = [
      "weapon",
      "violence",
      "gambling",
      "dating",
      "bypass",
      "cheat on test",
    ];

    // Parent context can add extra blocked terms (comma-separated after "block:")
    const blockMatch = /block:\s*([^\n]+)/i.exec(args.parentGuardrailContext);
    const parentBlocks =
      blockMatch?.[1]
        ?.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) ?? [];

    const allBlocked = [...blockedKeywords, ...parentBlocks];
    const filteredTopics = allBlocked.filter((term) => prompt.includes(term));

    if (filteredTopics.length > 0) {
      return {
        allowed: false,
        response:
          "I can't help with that topic. Let's pick something that fits your family's learning guidelines. Try asking about math, science, reading, or another approved subject.",
        filteredTopics,
        reason: `Blocked by guardrails: ${filteredTopics.join(", ")}`,
      };
    }

    const allowedHint =
      guardrails.includes("stem") || guardrails.includes("math")
        ? "Focusing on STEM-aligned guidance."
        : "Staying within parent-approved educational bounds.";

    return {
      allowed: true,
      response: `[Mock educational assistant] ${allowedHint}\n\nRegarding: "${args.studentPrompt.slice(0, 200)}"\n\nHere's a parent-approved learning nudge: break the question into smaller steps, check what you already know, and write one clear next action. (Real AI wiring comes later.)`,
      filteredTopics: [],
      reason: "Passed parent guardrail context",
    };
  },
});
