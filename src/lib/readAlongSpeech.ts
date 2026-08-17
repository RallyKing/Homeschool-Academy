export const LOOKAHEAD_WORDS = 5;
export const SPEECH_LOCALE = "en-US";
export const TTS_RATE_MIN = 0.7;
export const TTS_RATE_MAX = 1.4;
export const TTS_RATE_DEFAULT = 0.9;
export const TTS_STORAGE_VOICE = "hsa.readAlong.voiceURI";
export const TTS_STORAGE_RATE = "hsa.readAlong.rate";

export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9']/g, "");
}

export function foldWord(raw: string): string {
  return normalizeWord(raw).replace(/'/g, "");
}

export function isSkippableToken(word: string): boolean {
  return normalizeWord(word).length === 0;
}

export function splitHighlightWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function wordIndexAtChar(text: string, charIndex: number): number {
  const i = Math.max(0, Math.min(charIndex, text.length));
  const prefix = text.slice(0, i);
  const completed = prefix.split(/\s+/).filter(Boolean).length;
  const atWordStart = i === 0 || /\s/.test(text[i - 1] ?? "");
  return atWordStart ? completed : Math.max(0, completed - 1);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length]!;
}

const HOMOPHONE_GROUPS: string[][] = [
  ["there", "their", "theyre"],
  ["to", "too", "two"],
  ["your", "youre"],
  ["here", "hear"],
  ["know", "no"],
  ["one", "won"],
  ["see", "sea"],
  ["for", "four", "fore"],
  ["be", "bee"],
  ["by", "bye", "buy"],
  ["i", "eye"],
  ["sun", "son"],
  ["right", "write"],
  ["new", "knew"],
  ["hole", "whole"],
  ["peace", "piece"],
  ["wait", "weight"],
  ["where", "wear"],
  ["which", "witch"],
  ["wood", "would"],
  ["meet", "meat"],
  ["read", "red"],
  ["ate", "eight"],
];

const HOMOPHONE_CANON = new Map<string, string>();
for (const group of HOMOPHONE_GROUPS) {
  const canon = group[0]!;
  for (const word of group) {
    HOMOPHONE_CANON.set(word, canon);
  }
}

function matchKey(raw: string): string {
  const folded = foldWord(raw);
  return HOMOPHONE_CANON.get(folded) ?? folded;
}

/** Target-specific ASR aliases. Never apply globally (e.g. "in" ≠ "tin"). */
const TARGET_ALIASES: Record<string, readonly string[]> = {
  a: ["a", "uh", "ah", "ay", "uhh"],
  tin: ["tin", "tinn", "tyn", "ten", "in"],
};

/** How 4–8 year olds often say a word. Keys are foldWord(expected). */
const KID_PRONUNCIATIONS: Record<string, readonly string[]> = {
  the: ["da", "de", "duh", "tha", "tuh"],
  them: ["dem", "em"],
  that: ["dat"],
  this: ["dis", "dit"],
  those: ["dose"],
  these: ["dese"],
  with: ["wif", "wit", "wid"],
  three: ["free", "tree"],
  little: ["lil", "liddle", "wittle"],
  because: ["cuz", "cause", "becuz", "cos"],
};

const VOWELS = new Set("aeiou");

function kidSimplify(folded: string): string {
  let s = folded;
  if (s.endsWith("ing") && s.length >= 5) {
    s = s.slice(0, -1);
  }
  return s.replace(/th/g, "d");
}

function droppedFinalConsonant(folded: string): string | null {
  if (folded.length < 3 || folded === "and") return null;
  const last = folded[folded.length - 1]!;
  if (VOWELS.has(last)) return null;
  return folded.slice(0, -1);
}

function kidSpeechMatch(eFold: string, hFold: string): boolean {
  const kidHeard = KID_PRONUNCIATIONS[eFold];
  if (kidHeard?.includes(hFold)) return true;
  const eKid = kidSimplify(eFold);
  const hKid = kidSimplify(hFold);
  if (eKid && eKid === hKid) return true;
  if (kidHeard?.includes(hKid)) return true;
  const dropped = droppedFinalConsonant(eFold);
  if (dropped && dropped === hFold) return true;
  if (eFold.endsWith("r") && eFold.length >= 3) {
    const stem = eFold.slice(0, -1);
    if (hFold === stem || hFold === `${stem}h`) return true;
  }
  if (
    eFold.length >= 4 &&
    hFold.length >= 4 &&
    eFold.startsWith("l") &&
    hFold.startsWith("w") &&
    kidSimplify(eFold.slice(1)) === kidSimplify(hFold.slice(1))
  ) {
    return true;
  }
  return false;
}

function isDroppedArticle(word: string): boolean {
  return foldWord(word) === "a";
}

export function wordsMatch(expected: string, heard: string): boolean {
  const eFold = foldWord(expected);
  const hFold = foldWord(heard);
  if (!eFold) return true;
  if (!hFold) return false;
  const aliases = TARGET_ALIASES[eFold];
  if (aliases?.includes(hFold)) return true;
  const e = matchKey(expected);
  const h = matchKey(heard);
  if (h === e) return true;
  if (kidSpeechMatch(eFold, hFold)) return true;
  // Short targets: exact/homophone/alias/kid-speech only so "a" does not match "the".
  if (eFold.length <= 3) return false;
  if (e.length >= 4 && h.length >= 4 && (h.includes(e) || e.includes(h))) {
    return true;
  }
  const dist = levenshtein(e, h);
  const max = e.length <= 5 ? 1 : 2;
  if (dist <= max) return true;
  const kidDist = levenshtein(kidSimplify(eFold), kidSimplify(hFold));
  return kidDist <= max;
}

export function tokenizeTranscript(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function transcriptMatchesWord(
  transcript: string,
  expected: string,
): boolean {
  const last = tokenizeTranscript(transcript).slice(-8);
  return last.some((t) => wordsMatch(expected, t));
}

function readableLookaheadWindow(
  words: string[],
  startIndex: number,
  maxReadable: number,
): Array<{ word: string; index: number }> {
  const window: Array<{ word: string; index: number }> = [];
  for (let i = startIndex; i < words.length && window.length < maxReadable; i++) {
    const word = words[i];
    if (!word || isSkippableToken(word)) continue;
    window.push({ word, index: i });
  }
  return window;
}

/**
 * Scan the full utterance. The current word must appear at least once
 * (kid-speech / aliases allowed). Extra words around it are fine.
 * After that hit, credit following unread words in order from tokens
 * after that match. Stop at the first unread word that was not said.
 * Does not jump to a later story duplicate just because a common word
 * appeared. `consumedTokens` is how far into the transcript the last
 * match reached.
 */
export function matchLookaheadSpeech(
  transcript: string,
  words: string[],
  startIndex: number,
  lookAhead = LOOKAHEAD_WORDS,
): { lastIndex: number; consumedTokens: number } {
  const none = { lastIndex: -1, consumedTokens: 0 };
  const tokens = tokenizeTranscript(transcript);
  if (tokens.length === 0 || startIndex >= words.length) return none;

  const cap = lookAhead <= 0 ? 1 : Math.min(lookAhead, LOOKAHEAD_WORDS);
  const window = readableLookaheadWindow(words, startIndex, cap);
  if (window.length === 0) return none;

  let tokenIdx = 0;
  let lastIndex = -1;
  let consumedTokens = 0;

  for (let w = 0; w < window.length; w++) {
    const expected = window[w]!;
    let found = false;
    while (tokenIdx < tokens.length) {
      const token = tokens[tokenIdx]!;
      if (wordsMatch(expected.word, token)) {
        lastIndex = expected.index;
        tokenIdx += 1;
        consumedTokens = tokenIdx;
        found = true;
        break;
      }
      const nextExpected = window[w + 1];
      if (
        isDroppedArticle(expected.word) &&
        nextExpected &&
        wordsMatch(nextExpected.word, token)
      ) {
        lastIndex = expected.index;
        found = true;
        break;
      }
      // After the current word is found, a later story word in this
      // leftover means we must not skip the unread word in between.
      // While still hunting for the current word, keep scanning.
      if (w > 0) {
        const laterHit = window
          .slice(w + 1)
          .some((item) => wordsMatch(item.word, token));
        if (laterHit) {
          return { lastIndex, consumedTokens };
        }
      }
      tokenIdx += 1;
    }
    if (!found) break;
  }

  return { lastIndex, consumedTokens };
}

export function farthestMatchedIndex(
  transcript: string,
  words: string[],
  startIndex: number,
  lookAhead = LOOKAHEAD_WORDS,
): number {
  return matchLookaheadSpeech(transcript, words, startIndex, lookAhead)
    .lastIndex;
}

export type MicIntent = "off" | "live" | "paused";
export type MicCommand = "none" | "start" | "stop";

/** Chrome beeps on every recognition.start(); wait before a rare engine restart. */
export const MIC_RESTART_DEBOUNCE_MS = 400;

export function micAfterCorrectMatch(intent: MicIntent): {
  intent: MicIntent;
  command: MicCommand;
} {
  return { intent, command: "none" };
}

export const MAX_WORD_MISS_TRIES = 3;

export function spokenWordForTts(rawWord: string): string {
  return rawWord.replace(/^[^\w]+|[^\w]+$/g, "") || rawWord;
}

export type MissTryPlan =
  | { kind: "unaided_retry"; spokenWord: string }
  | { kind: "tts_then_listen"; spokenWord: string }
  | { kind: "tts_then_skip"; spokenWord: string; result: "helped" };

/**
 * 1) Original miss — stay, unaided retry, mic stays on.
 * 2) Retry failed — TTS the word, stay, listen for a correct repeat.
 * 3) Still wrong — TTS once more, mark helped, skip to the next word.
 */
export function planMissTry(
  failedAttempts: number,
  rawWord: string,
): MissTryPlan {
  const spokenWord = spokenWordForTts(rawWord);
  if (failedAttempts < 2) {
    return { kind: "unaided_retry", spokenWord };
  }
  if (failedAttempts < MAX_WORD_MISS_TRIES) {
    return { kind: "tts_then_listen", spokenWord };
  }
  return { kind: "tts_then_skip", spokenWord, result: "helped" };
}

/** Keep the mic on after a miss so they can retry without a gap. */
export function micAfterMiss(intent: MicIntent): {
  intent: MicIntent;
  command: MicCommand;
} {
  return { intent, command: "none" };
}

/** Mute transcript analysis while TTS plays. Do not stop() — that beeps. */
export function micPauseForTts(intent: MicIntent): {
  intent: MicIntent;
  command: MicCommand;
} {
  if (intent === "off") {
    return { intent: "off", command: "none" };
  }
  return { intent: "paused", command: "none" };
}

export function shouldKeepMicEngine(intent: MicIntent): boolean {
  return intent === "live" || intent === "paused";
}

export function micAfterRecognitionEnded(
  intent: MicIntent,
): "restart" | "stay_off" {
  return shouldKeepMicEngine(intent) ? "restart" : "stay_off";
}

export function micAfterHelpFinished(intent: MicIntent): {
  intent: MicIntent;
  command: MicCommand;
} {
  if (intent === "paused") {
    return { intent: "live", command: "none" };
  }
  return { intent, command: "none" };
}

export function micAfterUserStop(): { intent: "off"; command: "stop" } {
  return { intent: "off", command: "stop" };
}

export function shouldDeferMicRestart(args: {
  alreadyStarting: boolean;
  lastStartAt: number;
  now: number;
  debounceMs?: number;
}): boolean {
  if (args.alreadyStarting) return true;
  const wait = args.debounceMs ?? MIC_RESTART_DEBOUNCE_MS;
  return args.now - args.lastStartAt < wait;
}

function transcriptIsExtension(current: string[], previous: string[]): boolean {
  if (previous.length === 0) return true;
  if (current.length < previous.length) return false;
  return previous.every(
    (token, i) => foldWord(token) === foldWord(current[i] ?? ""),
  );
}

/**
 * Speech not yet credited. Leftover finalized text after a match is
 * stripped so it cannot start a miss timer or jump the highlight.
 */
export function unmatchedTranscript(
  transcript: string,
  previous: string,
): string {
  const current = tokenizeTranscript(transcript);
  const prev = tokenizeTranscript(previous);
  if (current.length === 0) return "";
  if (transcriptIsExtension(current, prev)) {
    return current.slice(prev.length).join(" ");
  }
  return current.join(" ");
}

export function advanceCreditedTranscript(
  transcript: string,
  previous: string,
  consumedTokens: number,
): string {
  const current = tokenizeTranscript(transcript);
  const prev = tokenizeTranscript(previous);
  const take = Math.max(0, consumedTokens);
  if (transcriptIsExtension(current, prev)) {
    return current.slice(0, prev.length + take).join(" ");
  }
  return current.slice(0, take).join(" ");
}

export function hasNewUnmatchedSpeech(
  transcript: string,
  transcriptAtLastMatch: string,
): boolean {
  return unmatchedTranscript(transcript, transcriptAtLastMatch).length > 0;
}

export function isUsEnglishLang(lang: string): boolean {
  return lang.toLowerCase().replace(/_/g, "-").startsWith("en-us");
}

export function preferUsEnglishVoice<T extends { lang: string }>(
  voices: readonly T[],
): T | null {
  return voices.find((voice) => isUsEnglishLang(voice.lang)) ?? null;
}

export function clampTtsRate(rate: number): number {
  if (!Number.isFinite(rate)) return TTS_RATE_DEFAULT;
  return Math.min(TTS_RATE_MAX, Math.max(TTS_RATE_MIN, rate));
}

export function parseTtsRate(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return TTS_RATE_DEFAULT;
  return clampTtsRate(Number(raw));
}

export function ttsRateForPreset(
  preset: "slow" | "normal" | "fast",
): number {
  if (preset === "slow") return TTS_RATE_MIN;
  if (preset === "fast") return 1.25;
  return TTS_RATE_DEFAULT;
}

export function listEnglishVoices<T extends { lang: string }>(
  voices: readonly T[],
): T[] {
  return voices.filter((voice) =>
    voice.lang.toLowerCase().replace(/_/g, "-").startsWith("en"),
  );
}

export function pickTtsVoice<T extends { lang: string; voiceURI?: string }>(
  voices: readonly T[],
  voiceURI: string,
): T | null {
  if (voiceURI) {
    const saved = voices.find((voice) => voice.voiceURI === voiceURI);
    if (saved) return saved;
  }
  return preferUsEnglishVoice(voices);
}

export function remainingStoryWords(
  words: string[],
  startIndex: number,
): string[] {
  return words.slice(Math.max(0, startIndex));
}

export function loadReadAlongTtsSettings(): {
  voiceURI: string;
  rate: number;
} {
  if (typeof window === "undefined") {
    return { voiceURI: "", rate: TTS_RATE_DEFAULT };
  }
  try {
    return {
      voiceURI: window.localStorage.getItem(TTS_STORAGE_VOICE) ?? "",
      rate: parseTtsRate(window.localStorage.getItem(TTS_STORAGE_RATE)),
    };
  } catch {
    return { voiceURI: "", rate: TTS_RATE_DEFAULT };
  }
}

export function saveReadAlongTtsSettings(settings: {
  voiceURI: string;
  rate: number;
}): { voiceURI: string; rate: number } {
  const next = {
    voiceURI: settings.voiceURI,
    rate: clampTtsRate(settings.rate),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TTS_STORAGE_VOICE, next.voiceURI);
      window.localStorage.setItem(TTS_STORAGE_RATE, String(next.rate));
    } catch {
      // ignore quota / private mode
    }
  }
  return next;
}

export function configureReadAlongRecognition(rec: {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}): void {
  rec.lang = SPEECH_LOCALE;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
}

export function displayWord(word: string): string {
  return word;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let speakGeneration = 0;
let storyReadGen = 0;
let highlightTimer: number | null = null;
let highlightInterval: number | null = null;

function clearHighlightTimers() {
  if (highlightTimer != null) {
    window.clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  if (highlightInterval != null) {
    window.clearInterval(highlightInterval);
    highlightInterval = null;
  }
}

function resolveUtteranceVoice(
  voiceURI: string | undefined,
): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return pickTtsVoice(voices, voiceURI ?? "");
}

export function speakText(
  text: string,
  opts?: {
    rate?: number;
    voiceURI?: string;
    onBoundaryWord?: (wordIndex: number) => void;
    onEnd?: () => void;
  },
): void {
  if (!ttsSupported() || !text.trim()) {
    opts?.onEnd?.();
    return;
  }

  const gen = ++speakGeneration;
  clearHighlightTimers();
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = clampTtsRate(opts?.rate ?? TTS_RATE_DEFAULT);
  utterance.lang = SPEECH_LOCALE;
  const voice = resolveUtteranceVoice(opts?.voiceURI);
  if (voice) utterance.voice = voice;

  const onDone = () => {
    if (gen !== speakGeneration) return;
    clearHighlightTimers();
    opts?.onEnd?.();
  };

  if (opts?.onBoundaryWord) {
    let boundaryFired = false;
    const words = splitHighlightWords(text);
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (gen !== speakGeneration) return;
      if (event.name && event.name !== "word") return;
      boundaryFired = true;
      clearHighlightTimers();
      const idx = Math.min(
        words.length - 1,
        wordIndexAtChar(text, event.charIndex),
      );
      if (idx >= 0) opts.onBoundaryWord?.(idx);
    };

    const msPerWord = Math.max(220, Math.round(1000 / (2.6 * utterance.rate)));
    highlightTimer = window.setTimeout(() => {
      if (gen !== speakGeneration || boundaryFired || words.length === 0) return;
      let i = 0;
      opts.onBoundaryWord?.(0);
      highlightInterval = window.setInterval(() => {
        if (gen !== speakGeneration) {
          clearHighlightTimers();
          return;
        }
        i += 1;
        if (i >= words.length) {
          clearHighlightTimers();
          return;
        }
        opts.onBoundaryWord?.(i);
      }, msPerWord);
    }, 280);
  }

  utterance.onend = onDone;
  utterance.onerror = onDone;
  window.speechSynthesis.speak(utterance);
}

export function speakStoryFrom(
  words: string[],
  startIndex: number,
  opts?: {
    rate?: number;
    voiceURI?: string;
    onWord?: (index: number) => void;
    onEnd?: () => void;
  },
): void {
  const gen = ++storyReadGen;
  const speakAt = (i: number) => {
    if (gen !== storyReadGen) return;
    if (i >= words.length) {
      opts?.onEnd?.();
      return;
    }
    const raw = words[i];
    if (!raw || isSkippableToken(raw)) {
      speakAt(i + 1);
      return;
    }
    opts?.onWord?.(i);
    speakText(spokenWordForTts(raw), {
      rate: opts?.rate,
      voiceURI: opts?.voiceURI,
      onEnd: () => speakAt(i + 1),
    });
  };
  speakAt(Math.max(0, startIndex));
}

export function stopSpeaking(): void {
  speakGeneration += 1;
  storyReadGen += 1;
  clearHighlightTimers();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
