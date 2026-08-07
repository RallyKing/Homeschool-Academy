import { v } from "convex/values";

/** Shared AI capability IDs — keep narrow and parsable. */
export const capabilityIdValidator = v.union(
  v.literal("guardrails"),
  v.literal("badge_craft"),
  v.literal("course_assist"),
  v.literal("family_optimize"),
  v.literal("child_personalize"),
);

export type CapabilityId =
  | "guardrails"
  | "badge_craft"
  | "course_assist"
  | "family_optimize"
  | "child_personalize";

export const providerValidator = v.union(
  v.literal("mock"),
  v.literal("openai"),
  v.literal("gateway"),
);

export const ageBandValidator = v.union(
  v.literal("early_elementary"),
  v.literal("elementary"),
  v.literal("middle"),
  v.literal("teen"),
  v.literal("mixed"),
);

export type AgeBand =
  | "early_elementary"
  | "elementary"
  | "middle"
  | "teen"
  | "mixed";

export const badgeProposalShapeValidator = v.object({
  key: v.string(),
  title: v.string(),
  description: v.string(),
  iconHint: v.string(),
  criteriaSummary: v.string(),
  ageBand: v.string(),
});

export const recommendationItemValidator = v.object({
  area: v.string(),
  title: v.string(),
  detail: v.string(),
  priority: v.union(
    v.literal("low"),
    v.literal("medium"),
    v.literal("high"),
  ),
});

export const capabilityMetaValidator = v.object({
  id: capabilityIdValidator,
  description: v.string(),
  inputSummary: v.string(),
  outputSummary: v.string(),
});

export function ageBandFromBirthYear(
  birthYear: number | undefined,
  referenceYear: number,
): AgeBand {
  if (birthYear === undefined) return "mixed";
  const age = referenceYear - birthYear;
  if (age <= 7) return "early_elementary";
  if (age <= 10) return "elementary";
  if (age <= 13) return "middle";
  return "teen";
}

export function ageBandLabel(band: AgeBand): string {
  switch (band) {
    case "early_elementary":
      return "ages ~5–7";
    case "elementary":
      return "ages ~8–10";
    case "middle":
      return "ages ~11–13";
    case "teen":
      return "ages ~14+";
    default:
      return "mixed ages";
  }
}
