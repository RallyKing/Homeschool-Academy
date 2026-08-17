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
