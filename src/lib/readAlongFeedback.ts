export const IDLE_PAUSE_MS = 6000;
export const IDLE_PAUSE_MESSAGE = "Paused — no reading for 6 seconds";

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
}): boolean {
  if (!args.listening) return false;
  return args.now - args.lastActivityAt > IDLE_PAUSE_MS;
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
