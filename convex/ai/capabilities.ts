import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUser } from "../lib/auth";
import {
  capabilityMetaValidator,
  type CapabilityId,
} from "./types";

/**
 * Capability registry — each use-case is a narrowly scoped AI skill.
 * Handlers live in sibling action modules; this file is metadata only.
 *
 * To add a capability:
 * 1. Add an id to CapabilityId / capabilityIdValidator in types.ts
 * 2. Register meta here
 * 3. Add convex/ai/<name>.ts action with strict system prompt + mock fallback
 * 4. Wire a tab/stub in /family/ai (or domain UI)
 */
export const CAPABILITY_REGISTRY: Array<{
  id: CapabilityId;
  description: string;
  inputSummary: string;
  outputSummary: string;
}> = [
  {
    id: "guardrails",
    description:
      "Parent-approved educational filter for student prompts (legacy filterPrompt).",
    inputSummary: "studentPrompt + parentGuardrailContext",
    outputSummary: "allowed, response, filteredTopics, reason, provider",
  },
  {
    id: "badge_craft",
    description:
      "Propose age-appropriate achievement badges from student stats; parent must accept.",
    inputSummary: "studentId + optional parentGuardrailContext",
    outputSummary: "proposed badges[] with key/title/description/ageBand",
  },
  {
    id: "course_assist",
    description:
      "Short on-topic help within a course, constrained by parent guardrails.",
    inputSummary: "courseId, studentId, question, parentGuardrailContext",
    outputSummary: "allowed, answer, topics, provider",
  },
  {
    id: "family_optimize",
    description:
      "Family-level learning plan tips from aggregate courses, logs, and chores (non-medical).",
    inputSummary: "familyId + optional parentGuardrailContext",
    outputSummary: "recommendations[] with area/title/detail/priority",
  },
  {
    id: "child_personalize",
    description:
      "Per-child development & learning suggestions using age band and academic level.",
    inputSummary: "studentId + optional parentGuardrailContext",
    outputSummary: "recommendations[] tailored to one student",
  },
  {
    id: "read_along_story",
    description:
      "Generate a read-along story from a parent-authored recipe (grade, theme, morals, length, prompt).",
    inputSummary:
      "recipeId, studentId, optional parentGuardrailContext",
    outputSummary: "title, body, words[], ageBand, provider",
  },
  {
    id: "vocab_explain",
    description:
      "Simple, age-fit definition for one word in a read-along story.",
    inputSummary: "word + ageBand + optional parentGuardrailContext",
    outputSummary: "word, definition, example, provider",
  },
];

export const listCapabilities = query({
  args: {},
  returns: v.array(capabilityMetaValidator),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return CAPABILITY_REGISTRY;
  },
});
