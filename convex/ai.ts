"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const resultValidator = v.object({
  allowed: v.boolean(),
  response: v.string(),
  filteredTopics: v.array(v.string()),
  reason: v.string(),
  provider: v.union(v.literal("mock"), v.literal("openai")),
});

function keywordFilter(
  studentPrompt: string,
  parentGuardrailContext: string,
): { filteredTopics: string[]; blocked: boolean } {
  const prompt = studentPrompt.toLowerCase();
  const blockedKeywords = [
    "weapon",
    "violence",
    "gambling",
    "dating",
    "bypass",
    "cheat on test",
  ];

  const blockMatch = /block:\s*([^\n]+)/i.exec(parentGuardrailContext);
  const parentBlocks =
    blockMatch?.[1]
      ?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];

  const allBlocked = [...blockedKeywords, ...parentBlocks];
  const filteredTopics = allBlocked.filter((term) => prompt.includes(term));
  return { filteredTopics, blocked: filteredTopics.length > 0 };
}

/**
 * AI guardrails: parent-approved educational filtering.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise a deterministic mock.
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const system = `You are a constrained educational assistant for a homeschool student.
Parent guardrails (MUST follow):
${args.parentGuardrailContext}

Rules:
- Stay educational, age-appropriate, and within the parent's guidelines.
- Do not help with cheating, violence, or adult content.
- Keep answers concise (under 200 words) with one clear next learning step.
- If the question conflicts with guardrails, politely refuse and suggest an allowed topic.`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.4,
            messages: [
              { role: "system", content: system },
              { role: "user", content: args.studentPrompt },
            ],
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content =
            data.choices?.[0]?.message?.content?.trim() ||
            "Let's try a different question within your family's guidelines.";
          return {
            allowed: true,
            response: content,
            filteredTopics: [],
            reason: "Passed keyword filter; answered via OpenAI",
            provider: "openai" as const,
          };
        }
      } catch {
        // Fall through to mock
      }
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
      reason: "Passed parent guardrail context (mock — set OPENAI_API_KEY for live LLM)",
      provider: "mock" as const,
    };
  },
});
