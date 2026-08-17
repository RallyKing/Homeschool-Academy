export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9']/g, "");
}

export function isSkippableToken(word: string): boolean {
  return normalizeWord(word).length === 0;
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

export function wordsMatch(expected: string, heard: string): boolean {
  const e = normalizeWord(expected);
  const h = normalizeWord(heard);
  if (!e) return true;
  if (!h) return false;
  if (h === e) return true;
  if (h.includes(e) || e.includes(h)) return true;
  const dist = levenshtein(e, h);
  const max = e.length <= 4 ? 1 : e.length <= 8 ? 2 : 3;
  return dist <= max;
}

export function transcriptMatchesWord(transcript: string, expected: string): boolean {
  const tokens = transcript
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const last = tokens.slice(-4);
  return last.some((t) => wordsMatch(expected, t));
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
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = opts?.rate ?? 0.9;
  utterance.lang = "en-US";
  if (opts?.onBoundaryWord) {
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name !== "word") return;
      const prefix = text.slice(0, event.charIndex);
      const idx = prefix.trim() ? prefix.trim().split(/\s+/).length : 0;
      opts.onBoundaryWord?.(idx);
    };
  }
  utterance.onend = () => opts?.onEnd?.();
  utterance.onerror = () => opts?.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
