import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_IDLE_PAUSE_SEC,
  IDLE_PAUSE_MAX_SEC,
  IDLE_PAUSE_MIN_SEC,
  IDLE_PAUSE_MS,
  IDLE_PAUSE_PRESETS_SEC,
  IDLE_PAUSE_STORAGE_KEY,
  backupWordState,
  clampIdlePauseSec,
  idlePauseMessage,
  idlePauseMs,
  loadIdlePauseSec,
  parseIdlePauseSec,
  previousReadableIndex,
  saveIdlePauseSec,
  shouldIdlePause,
  visibleWordResult,
  latestWordMarks,
  wordFeedback,
} from "./readAlongFeedback.ts";

describe("wordFeedback", () => {
  it("shows a star for words logged as correct", () => {
    assert.deepEqual(wordFeedback("correct"), { star: true, missed: false });
  });

  it("shows a star for words logged as retry_ok", () => {
    assert.deepEqual(wordFeedback("retry_ok"), { star: true, missed: false });
  });

  it("highlights words logged as helped / missed", () => {
    assert.deepEqual(wordFeedback("helped"), { star: false, missed: true });
  });

  it("shows nothing before a word is logged", () => {
    assert.deepEqual(wordFeedback(undefined), { star: false, missed: false });
  });
});

describe("latestWordMarks", () => {
  it("keeps the latest result per word index", () => {
    const marks = latestWordMarks([
      { wordIndex: 0, result: "helped", createdAt: 1 },
      { wordIndex: 0, result: "retry_ok", createdAt: 2 },
      { wordIndex: 1, result: "correct", createdAt: 3 },
    ]);
    assert.equal(marks.get(0), "retry_ok");
    assert.equal(marks.get(1), "correct");
  });
});

describe("shouldIdlePause", () => {
  it("pauses after more than 6 seconds of silence while listening", () => {
    assert.equal(
      shouldIdlePause({
        listening: true,
        lastActivityAt: 1000,
        now: 1000 + IDLE_PAUSE_MS + 1,
      }),
      true,
    );
  });

  it("does not pause at exactly 6 seconds", () => {
    assert.equal(
      shouldIdlePause({
        listening: true,
        lastActivityAt: 1000,
        now: 1000 + IDLE_PAUSE_MS,
      }),
      false,
    );
  });

  it("does not pause when the mic is already off", () => {
    assert.equal(
      shouldIdlePause({
        listening: false,
        lastActivityAt: 0,
        now: 60_000,
      }),
      false,
    );
  });

  it("uses a custom inactivity window when provided", () => {
    assert.equal(
      shouldIdlePause({
        listening: true,
        lastActivityAt: 1000,
        now: 1000 + 10_000,
        idleMs: 10_000,
      }),
      false,
    );
    assert.equal(
      shouldIdlePause({
        listening: true,
        lastActivityAt: 1000,
        now: 1000 + 10_001,
        idleMs: 10_000,
      }),
      true,
    );
  });
});

describe("idle pause timer settings", () => {
  it("defaults to 6 seconds and offers 5/10/15/30 presets", () => {
    assert.equal(DEFAULT_IDLE_PAUSE_SEC, 6);
    assert.equal(IDLE_PAUSE_MS, 6000);
    assert.deepEqual([...IDLE_PAUSE_PRESETS_SEC], [5, 10, 15, 30]);
  });

  it("clamps custom seconds between 3 and 120", () => {
    assert.equal(clampIdlePauseSec(2), IDLE_PAUSE_MIN_SEC);
    assert.equal(clampIdlePauseSec(121), IDLE_PAUSE_MAX_SEC);
    assert.equal(clampIdlePauseSec(7.4), 7);
  });

  it("parses stored values and falls back to 6 seconds", () => {
    assert.equal(parseIdlePauseSec("15"), 15);
    assert.equal(parseIdlePauseSec("nope"), DEFAULT_IDLE_PAUSE_SEC);
    assert.equal(parseIdlePauseSec(null), DEFAULT_IDLE_PAUSE_SEC);
  });

  it("persists the chosen timer in localStorage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    assert.equal(loadIdlePauseSec(storage), DEFAULT_IDLE_PAUSE_SEC);
    assert.equal(saveIdlePauseSec(30, storage), 30);
    assert.equal(store.get(IDLE_PAUSE_STORAGE_KEY), "30");
    assert.equal(loadIdlePauseSec(storage), 30);
  });

  it("describes the pause using the chosen number of seconds", () => {
    assert.equal(
      idlePauseMessage(10),
      "Paused — no reading for 10 seconds",
    );
    assert.equal(idlePauseMs(5), 5000);
  });
});

describe("previousReadableIndex", () => {
  it("steps back over punctuation to the previous word", () => {
    assert.equal(previousReadableIndex(["The", "cat", ",", "sat"], 3), 1);
  });

  it("returns -1 on the first readable word", () => {
    assert.equal(previousReadableIndex(["The", "cat"], 0), -1);
  });
});

describe("backupWordState", () => {
  it("moves the cursor back and clears later stars and misses", () => {
    const next = backupWordState({
      words: ["The", "cat", "sat", "on"],
      currentIndex: 3,
      localMarks: { 0: "correct", 1: "correct", 2: "helped" },
      pending: [
        { wordIndex: 1, word: "cat", result: "correct" },
        { wordIndex: 2, word: "sat", result: "helped" },
      ],
    });
    assert.equal(next.canBackup, true);
    assert.equal(next.nextIndex, 2);
    assert.deepEqual(next.localMarks, { 0: "correct", 1: "correct" });
    assert.deepEqual(next.pending, [
      { wordIndex: 1, word: "cat", result: "correct" },
    ]);
    assert.equal(next.hiddenFrom, 2);
  });

  it("cannot backup from the first word", () => {
    const next = backupWordState({
      words: ["The", "cat"],
      currentIndex: 0,
      localMarks: {},
      pending: [],
    });
    assert.equal(next.canBackup, false);
    assert.equal(next.nextIndex, 0);
  });
});

describe("visibleWordResult", () => {
  it("hides server stars from the backup point forward", () => {
    const server = new Map([
      [0, "correct"],
      [1, "correct"],
      [2, "helped"],
    ] as const);
    assert.equal(
      visibleWordResult(1, {}, server, 1),
      undefined,
    );
    assert.equal(visibleWordResult(0, {}, server, 1), "correct");
  });

  it("keeps a newly logged local mark after backup", () => {
    const server = new Map([[1, "correct"]] as const);
    assert.equal(
      visibleWordResult(1, { 1: "retry_ok" }, server, 1),
      "retry_ok",
    );
  });
});
