export const DEFINITION_UNAVAILABLE = "Definition unavailable";

export const dictionarySourceValidatorValues = [
  "merriam-webster",
  "dictionaryapi.dev",
  "manual",
] as const;

export type DictionarySource = (typeof dictionarySourceValidatorValues)[number];

export type DictionarySense = {
  word: string;
  definition: string;
  partOfSpeech?: string;
  example?: string;
  source: DictionarySource;
};

const ADULT_DEFINITION_RE =
  /\b(pubic|genitalia|genital|porn|erotic|sexual intercourse|orgasm|masturbat)\b/i;

export function normalizeDictionaryWord(word: string): string {
  const trimmed = word.trim().toLowerCase().replace(/['’]s$/i, "");
  const kept = trimmed.replace(/[^a-z0-9-]/g, "");
  return kept.replace(/^-+|-+$/g, "");
}

export function stripMerriamMarkup(text: string): string {
  return text
    .replace(/\{bc\}/g, "")
    .replace(/\{(?:a_link|d_link|et_link|mat|sx)\|([^|{}]+)[^}]*\}/g, "$1")
    .replace(/\{\/?[a-z0-9_]+\}/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeDefinition(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const ended = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return ended.charAt(0).toUpperCase() + ended.slice(1);
}

function isKidSafeDefinition(definition: string): boolean {
  return !ADULT_DEFINITION_RE.test(definition);
}

const SIMPLE_SUFFIXES = ["s", "es", "ed", "ing", "er", "est", "ly"] as const;

function isSimpleInflection(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!longer.startsWith(shorter)) return false;
  return SIMPLE_SUFFIXES.includes(
    longer.slice(shorter.length) as (typeof SIMPLE_SUFFIXES)[number],
  );
}

function wordMatchesEntry(requested: string, entryWord: string, stems?: string[]): boolean {
  const want = normalizeDictionaryWord(requested);
  if (!want) return false;
  const names = [entryWord, ...(stems ?? [])].map(normalizeDictionaryWord);
  if (names.includes(want)) return true;
  return names.some((name) => name.length > 0 && isSimpleInflection(want, name));
}

function definitionScore(definition: string, example?: string): number {
  const words = definition.split(/\s+/).filter(Boolean).length;
  if (words < 4) return definition.length * 0.05;
  return Math.min(definition.length, 240) + (example ? 50 : 0);
}

export function parseFreeDictionary(
  requestedWord: string,
  payload: unknown,
): DictionarySense | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;

  let best: { sense: DictionarySense; score: number } | null = null;

  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as {
      word?: unknown;
      meanings?: unknown;
    };
    if (typeof record.word !== "string") continue;
    if (!wordMatchesEntry(requestedWord, record.word)) continue;
    if (!Array.isArray(record.meanings)) continue;

    for (const meaning of record.meanings) {
      if (!meaning || typeof meaning !== "object") continue;
      const m = meaning as {
        partOfSpeech?: unknown;
        definitions?: unknown;
      };
      const partOfSpeech =
        typeof m.partOfSpeech === "string" ? m.partOfSpeech : undefined;
      if (!Array.isArray(m.definitions)) continue;

      for (const def of m.definitions) {
        if (!def || typeof def !== "object") continue;
        const d = def as { definition?: unknown; example?: unknown };
        if (typeof d.definition !== "string") continue;
        const definition = capitalizeDefinition(d.definition);
        if (!definition || !isKidSafeDefinition(definition)) continue;
        const example =
          typeof d.example === "string" && d.example.trim()
            ? d.example.trim()
            : undefined;
        const score = definitionScore(definition, example);
        if (best && score <= best.score) continue;
        best = {
          score,
          sense: {
            word: normalizeDictionaryWord(requestedWord),
            definition,
            partOfSpeech,
            example,
            source: "dictionaryapi.dev",
          },
        };
      }
    }
  }

  return best?.sense ?? null;
}

export function parseMerriamWebster(
  requestedWord: string,
  payload: unknown,
): DictionarySense | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  if (payload.every((item) => typeof item === "string")) return null;

  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as {
      meta?: { id?: unknown; stems?: unknown };
      fl?: unknown;
      shortdef?: unknown;
    };
    const metaId = typeof record.meta?.id === "string" ? record.meta.id : "";
    const headword = metaId.split(":")[0] ?? "";
    const stems = Array.isArray(record.meta?.stems)
      ? record.meta.stems.filter((s): s is string => typeof s === "string")
      : [];
    if (!wordMatchesEntry(requestedWord, headword, stems)) continue;

    const shorts = Array.isArray(record.shortdef)
      ? record.shortdef.filter((s): s is string => typeof s === "string")
      : [];
    for (const raw of shorts) {
      const definition = capitalizeDefinition(stripMerriamMarkup(raw));
      if (!definition || !isKidSafeDefinition(definition)) continue;
      const partOfSpeech =
        typeof record.fl === "string" ? record.fl : undefined;
      return {
        word: normalizeDictionaryWord(requestedWord),
        definition,
        partOfSpeech,
        source: "merriam-webster",
      };
    }
  }

  return null;
}

export function websterKeyFromEnv(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const key =
    env.MERRIAM_WEBSTER_API_KEY ??
    env.WEBSTER_API_KEY ??
    env.MW_DICTIONARY_KEY;
  if (!key || !key.trim()) return null;
  return key.trim();
}
