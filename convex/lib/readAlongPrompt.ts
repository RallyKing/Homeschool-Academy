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

export const SPOKEN_CONTEXT_PROMPT_RULES = `Spoken-context rules (required so a speech recognizer can confirm every word):
1. No isolated ambiguous tokens. Never end a sentence or clause on a bare word such as tin, can (the metal), read, lead, wind, bow, tear, bass, or other homophones. Never strand a lone article a, an, the without its noun in the same breath-group.
2. Every content word must appear in a natural collocation a child would say: adjective+noun, noun+noun (tin can, tin cup), verb+object. Prefer concrete, picturable phrases.
3. Articles (a, an, the) must immediately precede a clear noun phrase in the same sentence. Write "a tin can", never "a tin."
4. Avoid 1–2 word sentences that are only an article plus a short noun. Prefer full actions: "Sam picked up a tin can."
5. Prefer words that are easy to hear in American English at this grade. You may use harder short words only when wrapped in neighboring context.
6. Do not dump a glossary of random words with no story glue.
7. Keep the story age-appropriate and matching the grade, theme, and morals.`;

/** True when the stored prompt is a parent override, not the auto-generated recipe text. */
export function recipeUsesCustomPrompt(
  storedPrompt: string,
  autoPrompt: string,
): boolean {
  const stored = storedPrompt.trim();
  const auto = autoPrompt.trim();
  if (!stored || stored === auto) return false;
  const legacyAuto = auto.replace(SPOKEN_CONTEXT_PROMPT_RULES, "").trim();
  return stored !== legacyAuto;
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
    SPOKEN_CONTEXT_PROMPT_RULES,
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
