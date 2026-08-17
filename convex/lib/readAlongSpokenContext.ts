/**
 * Spoken-context checks for read-along stories.
 * Short/ambiguous words need a neighboring content word so ASR can confirm them.
 */

const ARTICLES = new Set(["a", "an", "the"]);

/** Tokens that do not disambiguate a neighbor for a speech recognizer. */
const WEAK_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "are",
  "am",
  "it",
  "its",
  "it's",
  "he",
  "she",
  "we",
  "they",
  "i",
  "me",
  "my",
  "his",
  "her",
  "him",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "with",
  "from",
  "by",
  "of",
  "and",
  "or",
  "but",
  "as",
  "at",
  "in",
  "on",
  "so",
  "if",
  "not",
  "no",
  "oh",
  "ah",
  "then",
  "than",
]);

const AMBIGUOUS_WORDS = new Set([
  "a",
  "an",
  "the",
  "tin",
  "can",
  "to",
  "too",
  "two",
  "for",
  "four",
  "red",
  "read",
  "lead",
  "wind",
  "bow",
  "tear",
  "bass",
]);

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z']/g, "");
}

function splitSentences(body: string): string[] {
  const parts = body
    .split(/(?<=[.!?])(?:\s+|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [body.trim()].filter(Boolean);
}

function wordsIn(sentence: string): string[] {
  return sentence.split(/\s+/).map(normalizeToken).filter(Boolean);
}

function isContentWord(word: string): boolean {
  return word.length >= 2 && !WEAK_WORDS.has(word);
}

function hasNearbyContent(words: string[], index: number): boolean {
  const prev = index > 0 ? words[index - 1] : undefined;
  const next = index + 1 < words.length ? words[index + 1] : undefined;
  if (prev && isContentWord(prev)) return true;
  if (next && isContentWord(next)) return true;
  const prev2 = index > 1 ? words[index - 2] : undefined;
  const next2 = index + 2 < words.length ? words[index + 2] : undefined;
  if (prev && WEAK_WORDS.has(prev) && prev2 && isContentWord(prev2)) return true;
  if (next && WEAK_WORDS.has(next) && next2 && isContentWord(next2)) return true;
  return false;
}

function isShortAmbiguousSentence(words: string[]): boolean {
  if (words.length === 0 || words.length > 2) return false;
  const hasAmbiguous = words.some((word) => AMBIGUOUS_WORDS.has(word));
  const hasClearContent = words.some(
    (word) => isContentWord(word) && !AMBIGUOUS_WORDS.has(word),
  );
  return hasAmbiguous && !hasClearContent;
}

export function findSpokenContextIssues(body: string): string[] {
  const text = body.trim();
  if (!text) return ["empty story"];

  const issues: string[] = [];
  for (const sentence of splitSentences(text)) {
    const words = wordsIn(sentence);
    if (isShortAmbiguousSentence(words)) {
      issues.push(`too little context in "${sentence}"`);
      continue;
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word || !AMBIGUOUS_WORDS.has(word)) continue;
      const prev = i > 0 ? words[i - 1] : undefined;
      const next = i + 1 < words.length ? words[i + 1] : undefined;

      if (ARTICLES.has(word)) {
        if (!next || !isContentWord(next)) {
          issues.push(`stranded article "${word}" in "${sentence}"`);
        }
        continue;
      }

      if (!hasNearbyContent(words, i)) {
        issues.push(`isolated "${word}" in "${sentence}"`);
      }
    }
  }
  return issues;
}

export function storyHasSpokenContext(body: string): boolean {
  return findSpokenContextIssues(body).length === 0;
}
