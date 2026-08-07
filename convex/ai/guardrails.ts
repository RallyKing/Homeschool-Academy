"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { chatCompletion, keywordFilter } from "./provider";
import { providerValidator } from "./types";

const resultValidator = v.object({
  allowed: v.boolean(),
  response: v.string(),
  filteredTopics: v.array(v.string()),
  reason: v.string(),
  provider: providerValidator,
});

/**
 * Capability: guardrails — parent-approved educational filtering.
 * Kept as the original filterPrompt contract for backward compatibility.
 */
export const filterPrompt = action({
  args: {
    studentPrompt: v.string(),
    parentGuardrailContext: v.string(),
  },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const { filteredTopics, blocked } = keywordFilter(
      args.studentPrompt,
      args.parentGuardrailContext,
    );

    if (blocked) {
      return {
        allowed: false,
        response:
          "I can't help with that topic. Let's pick something that fits your family's learning guidelines. Try asking about math, science, reading, or another approved subject.",
        filteredTopics,
        reason: `Blocked by guardrails: ${filteredTopics.join(", ")}`,
        provider: "mock" as const,
      };
    }

    const llm = await chatCompletion({
      system: `You are a constrained educational assistant for a homeschool student.
Parent guardrails (MUST follow):
${args.parentGuardrailContext}

Rules:
- Stay educational, age-appropriate, and within the parent's guidelines.
- Do not help with cheating, violence, or adult content.
- Keep answers concise (under 200 words) with one clear next learning step.
- If the question conflicts with guardrails, politely refuse and suggest an allowed topic.
- Never compare students competitively.`,
      user: args.studentPrompt,
    });

    if (llm) {
      return {
        allowed: true,
        response: llm.content,
        filteredTopics: [],
        reason: "Passed keyword filter; answered via LLM",
        provider: llm.provider,
      };
    }

    const guardrails = args.parentGuardrailContext.toLowerCase();
    const allowedHint =
      guardrails.includes("stem") || guardrails.includes("math")
        ? "Focusing on STEM-aligned guidance."
        : "Staying within parent-approved educational bounds.";

    return {
      allowed: true,
      response: `[Demo educational assistant] ${allowedHint}\n\nRegarding: "${args.studentPrompt.slice(0, 200)}"\n\nHere's a parent-approved learning nudge: break the question into smaller steps, check what you already know, and write one clear next action.`,
      filteredTopics: [],
      reason:
        "Passed parent guardrail context (mock — set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)",
      provider: "mock" as const,
    };
  },
});
