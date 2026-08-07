"use node";

/**
 * Thin public surface for AI capabilities.
 * Prefer api.ai.<module>.* from new UI; filterPrompt kept for existing callers.
 */
export { filterPrompt } from "./ai/guardrails";
