"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { mockCourseAssistAnswer } from "./mocks";
import { chatCompletion, keywordFilter } from "./provider";
import { providerValidator } from "./types";

/**
 * Capability: course_assist — on-topic help inside one course + parent guardrails.
 */
export const ask = action({
  args: {
    courseId: v.id("courses"),
    studentId: v.id("students"),
    question: v.string(),
    parentGuardrailContext: v.string(),
  },
  returns: v.object({
    allowed: v.boolean(),
    answer: v.string(),
    filteredTopics: v.array(v.string()),
    courseTitle: v.string(),
    provider: providerValidator,
    reason: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    allowed: boolean;
    answer: string;
    filteredTopics: string[];
    courseTitle: string;
    provider: "mock" | "openai" | "gateway";
    reason: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const question = args.question.trim();
    if (!question) throw new Error("Question is required");

    const { filteredTopics, blocked } = keywordFilter(
      question,
      args.parentGuardrailContext,
    );

    const referenceYear = new Date().getFullYear();
    const context = (await ctx.runQuery(
      api.ai.context.getCourseAssistContext,
      {
        courseId: args.courseId,
        studentId: args.studentId,
        referenceYear,
      },
    )) as {
      courseTitle: string;
      courseType: string;
      subjectCategory?: string;
      student: {
        academicLevel?: string;
        ageBand: string;
      };
    };

    if (blocked) {
      return {
        allowed: false,
        answer:
          "I can't help with that under your family's guidelines. Ask something about this course topic instead.",
        filteredTopics,
        courseTitle: context.courseTitle,
        provider: "mock" as const,
        reason: `Blocked: ${filteredTopics.join(", ")}`,
      };
    }

    const llm = await chatCompletion({
      system: `You are a course assistant for ONE homeschool course.
Course: ${context.courseTitle} (${context.courseType}${
        context.subjectCategory ? `, ${context.subjectCategory}` : ""
      })
Student level: ${context.student.academicLevel ?? "unspecified"}, age band: ${context.student.ageBand}
Parent guardrails (MUST follow):
${args.parentGuardrailContext}

Rules:
- Answer ONLY about this course / subject.
- Keep under 150 words; one concrete next step.
- Age-appropriate; no cheating; no medical claims; no sibling comparisons.`,
      user: question,
    });

    if (llm) {
      return {
        allowed: true,
        answer: llm.content,
        filteredTopics: [],
        courseTitle: context.courseTitle,
        provider: llm.provider,
        reason: "Course-scoped LLM answer",
      };
    }

    return {
      allowed: true,
      answer: mockCourseAssistAnswer({
        courseTitle: context.courseTitle,
        question,
        academicLevel: context.student.academicLevel,
      }),
      filteredTopics: [],
      courseTitle: context.courseTitle,
      provider: "mock" as const,
      reason:
        "Course assist mock (set OPENAI_API_KEY or AI_GATEWAY_API_KEY for live LLM)",
    };
  },
});
