import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDLE_PAUSE_MS,
  latestWordMarks,
  shouldIdlePause,
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
});
