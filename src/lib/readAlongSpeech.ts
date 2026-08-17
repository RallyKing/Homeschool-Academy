export const LOOKAHEAD_WORDS = 8;

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

export function wordsMatch(expected: string, heard: string): boolean {
  const e = matchKey(expected);
  const h = matchKey(heard);
  if (!e) return true;
  if (!h) return false;
  if (h === e) return true;
  if (e.length >= 4 && h.length >= 4 && (h.includes(e) || e.includes(h))) {
    return true;
  }
  const dist = levenshtein(e, h);
  const max = e.length <= 5 ? 1 : 2;
  return dist <= max;
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

/**
 * Walk the transcript against expected words from `startIndex`.
 * Matching a later word in the look-ahead window counts as keeping up
 * (skipped-over words are treated as read).
 * Returns the farthest matched word index, or -1 if none matched.
 */
export function farthestMatchedIndex(
  transcript: string,
  words: string[],
  startIndex: number,
  lookAhead = LOOKAHEAD_WORDS,
): number {
  const tokens = tokenizeTranscript(transcript).slice(-24);
  if (tokens.length === 0 || startIndex >= words.length) return -1;

  const end = Math.min(words.length, startIndex + Math.max(0, lookAhead) + 1);
  let expectedFrom = startIndex;
  let lastMatched = -1;
  let matchedCurrent = false;

  for (const token of tokens) {
    for (let i = expectedFrom; i < end; i++) {
      const word = words[i];
      if (!word || isSkippableToken(word)) continue;
      if (!wordsMatch(word, token)) continue;
      lastMatched = i;
      expectedFrom = i + 1;
      if (i === startIndex) matchedCurrent = true;
      break;
    }
  }

  if (lastMatched < startIndex) return -1;
  if (!matchedCurrent && lastMatched > startIndex) {
    const anchor = foldWord(words[lastMatched] ?? "");
    if (anchor.length < 4) return -1;
  }
  return lastMatched;
}

export type MicIntent = "off" | "live" | "paused";
export type MicCommand = "none" | "start" | "stop";

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

/** Pause recognition only while TTS is speaking so the mic does not hear itself. */
export function micPauseForTts(intent: MicIntent): {
  intent: MicIntent;
  command: MicCommand;
} {
  if (intent === "off") {
    return { intent: "off", command: "none" };
  }
  return { intent: "paused", command: "stop" };
}

export function micAfterRecognitionEnded(
  intent: MicIntent,
): "restart" | "stay_off" {
  return intent === "live" ? "restart" : "stay_off";
}

export function micAfterHelpFinished(intent: MicIntent): {
  intent: MicIntent;
  command: MicCommand;
} {
  if (intent === "paused") {
    return { intent: "live", command: "start" };
  }
  return { intent, command: "none" };
}

export function micAfterUserStop(): { intent: "off"; command: "stop" } {
  return { intent: "off", command: "stop" };
}

/**
 * After a match, Chrome still reports the same finalized transcript.
 * That leftover text must not start a miss timer. New tokens (or a
 * fresh recognition session) should.
 */
export function hasNewUnmatchedSpeech(
  transcript: string,
  transcriptAtLastMatch: string,
): boolean {
  const current = tokenizeTranscript(transcript);
  const previous = tokenizeTranscript(transcriptAtLastMatch);
  if (current.length === 0) return false;
  if (previous.length === 0) return true;
  const isExtension = previous.every(
    (token, i) => foldWord(token) === foldWord(current[i] ?? ""),
  );
  if (isExtension) return current.length > previous.length;
  const same =
    current.length === previous.length &&
    previous.every((token, i) => foldWord(token) === foldWord(current[i] ?? ""));
  return !same;
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

export function speakText(
  text: string,
  opts?: {
    rate?: number;
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
  utterance.rate = opts?.rate ?? 0.9;
  utterance.lang = "en-US";

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

export function stopSpeaking(): void {
  speakGeneration += 1;
  clearHighlightTimers();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
