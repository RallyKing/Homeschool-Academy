export type ReadAlongLength = "short" | "medium" | "long";

export type ReadAlongRecipePromptInput = {
  gradeLevel: string;
  theme: string;
  moralLessons: string[] | string;
  length: ReadAlongLength;
  title?: string;
};

export function parseMoralLessons(raw: string[] | string): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(/[\n,;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const lesson = part.trim();
    if (!lesson) continue;
    const key = lesson.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lesson.slice(0, 160));
    if (out.length >= 12) break;
  }
  return out;
}

export function lengthTargets(length: ReadAlongLength): {
  words: string;
  minutes: number;
} {
  if (length === "short") return { words: "60–90", minutes: 3 };
  if (length === "long") return { words: "200–280", minutes: 10 };
  return { words: "120–180", minutes: 6 };
}

export function recipeTitleFromFields(
  title: string | undefined,
  theme: string,
): string {
  const named = title?.trim() ?? "";
  if (named) return named.slice(0, 120);
  const fromTheme = theme.trim();
  if (fromTheme) return fromTheme.slice(0, 120);
  return "Untitled story recipe";
}

/**
 * Builds the stored AI prompt from recipe fields. Parents fill grade, theme,
 * morals, and length — they do not write this prompt themselves.
 */
export function buildReadAlongRecipePrompt(
  input: ReadAlongRecipePromptInput,
): string {
  const gradeLevel = input.gradeLevel.trim() || "elementary";
  const theme = input.theme.trim() || "everyday homeschool life";
  const title = input.title?.trim();
  const morals = parseMoralLessons(input.moralLessons);
  const { words, minutes } = lengthTargets(input.length);
  const moralLine =
    morals.length > 0 ? morals.join("; ") : "a kind, concrete choice";
  const titleLine =
    title && title.toLowerCase() !== theme.toLowerCase()
      ? `Recipe title: "${title}".`
      : "";

  return [
    `Write a gentle original read-aloud for grade ${gradeLevel} about ${theme}.`,
    titleLine,
    `Weave in these moral lessons by showing, not lecturing: ${moralLine}.`,
    `Keep it ${input.length} (${words} words, about ${minutes} minutes of reading).`,
    "Use age-appropriate vocabulary, short concrete scenes, and end with the lesson shown in action rather than a speech.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Use a custom override when it is long enough; otherwise generate from fields. */
export function resolveReadAlongRecipePrompt(
  input: ReadAlongRecipePromptInput & { customPrompt?: string },
): string {
  const custom = input.customPrompt?.trim() ?? "";
  if (custom.length >= 20) return custom;
  return buildReadAlongRecipePrompt(input);
}
