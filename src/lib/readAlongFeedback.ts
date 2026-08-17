export const DEFAULT_IDLE_PAUSE_SEC = 6;
export const IDLE_PAUSE_MS = DEFAULT_IDLE_PAUSE_SEC * 1000;
export const IDLE_PAUSE_PRESETS_SEC = [5, 10, 15, 30] as const;
export const IDLE_PAUSE_MIN_SEC = 3;
export const IDLE_PAUSE_MAX_SEC = 120;
export const IDLE_PAUSE_STORAGE_KEY = "hsa.readAlong.idlePauseSec";
export const IDLE_PAUSE_MESSAGE = `Paused — no reading for ${DEFAULT_IDLE_PAUSE_SEC} seconds`;

export type IdlePauseStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function clampIdlePauseSec(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_IDLE_PAUSE_SEC;
  return Math.min(
    IDLE_PAUSE_MAX_SEC,
    Math.max(IDLE_PAUSE_MIN_SEC, Math.round(raw)),
  );
}

export function idlePauseMs(seconds: number): number {
  return clampIdlePauseSec(seconds) * 1000;
}

export function idlePauseMessage(seconds: number): string {
  return `Paused — no reading for ${clampIdlePauseSec(seconds)} seconds`;
}

export function parseIdlePauseSec(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return DEFAULT_IDLE_PAUSE_SEC;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_IDLE_PAUSE_SEC;
  return clampIdlePauseSec(n);
}

function browserIdlePauseStorage(): IdlePauseStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadIdlePauseSec(storage?: IdlePauseStorage | null): number {
  const store = storage === undefined ? browserIdlePauseStorage() : storage;
  if (!store) return DEFAULT_IDLE_PAUSE_SEC;
  try {
    return parseIdlePauseSec(store.getItem(IDLE_PAUSE_STORAGE_KEY));
  } catch {
    return DEFAULT_IDLE_PAUSE_SEC;
  }
}

export function saveIdlePauseSec(
  seconds: number,
  storage?: IdlePauseStorage | null,
): number {
  const sec = clampIdlePauseSec(seconds);
  const store = storage === undefined ? browserIdlePauseStorage() : storage;
  try {
    store?.setItem(IDLE_PAUSE_STORAGE_KEY, String(sec));
  } catch {
    // Ignore quota / private-mode failures; the in-memory value still applies.
  }
  return sec;
}

export type WordResult = "correct" | "retry_ok" | "helped";

export function wordFeedback(result: WordResult | undefined): {
  star: boolean;
  missed: boolean;
} {
  if (result === "correct" || result === "retry_ok") {
    return { star: true, missed: false };
  }
  if (result === "helped") {
    return { star: false, missed: true };
  }
  return { star: false, missed: false };
}

export function latestWordMarks(
  events: Array<{ wordIndex: number; result: WordResult; createdAt?: number }>,
): Map<number, WordResult> {
  const sorted = [...events].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
  const marks = new Map<number, WordResult>();
  for (const event of sorted) {
    marks.set(event.wordIndex, event.result);
  }
  return marks;
}

export function shouldIdlePause(args: {
  listening: boolean;
  lastActivityAt: number;
  now: number;
  idleMs?: number;
}): boolean {
  if (!args.listening) return false;
  const idleMs = args.idleMs ?? IDLE_PAUSE_MS;
  return args.now - args.lastActivityAt > idleMs;
}

export function previousReadableIndex(words: string[], from: number): number {
  let i = Math.min(from, words.length) - 1;
  while (i >= 0 && !/[a-z0-9]/i.test(words[i] ?? "")) {
    i -= 1;
  }
  return i;
}

export function backupWordState(args: {
  words: string[];
  currentIndex: number;
  localMarks: Record<number, WordResult>;
  pending: Array<{ wordIndex: number; word: string; result: WordResult }>;
}): {
  canBackup: boolean;
  nextIndex: number;
  localMarks: Record<number, WordResult>;
  pending: Array<{ wordIndex: number; word: string; result: WordResult }>;
  hiddenFrom: number;
} {
  const nextIndex = previousReadableIndex(args.words, args.currentIndex);
  if (nextIndex < 0) {
    return {
      canBackup: false,
      nextIndex: args.currentIndex,
      localMarks: args.localMarks,
      pending: args.pending,
      hiddenFrom: args.currentIndex,
    };
  }
  const localMarks: Record<number, WordResult> = {};
  for (const [key, value] of Object.entries(args.localMarks)) {
    const index = Number(key);
    if (index < nextIndex) localMarks[index] = value;
  }
  return {
    canBackup: true,
    nextIndex,
    localMarks,
    pending: args.pending.filter((event) => event.wordIndex < nextIndex),
    hiddenFrom: nextIndex,
  };
}

export function visibleWordResult(
  index: number,
  localMarks: Record<number, WordResult>,
  serverMarks: Map<number, WordResult>,
  hiddenFrom: number | null,
): WordResult | undefined {
  const local = localMarks[index];
  if (local !== undefined) return local;
  if (hiddenFrom != null && index >= hiddenFrom) return undefined;
  return serverMarks.get(index);
}
