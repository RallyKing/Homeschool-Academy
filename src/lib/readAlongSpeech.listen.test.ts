import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasNewUnmatchedSpeech,
  micAfterCorrectMatch,
  micAfterHelpFinished,
  micAfterMiss,
  micAfterRecognitionEnded,
  micAfterUserStop,
  micPauseForTts,
  planMissTry,
} from "./readAlongSpeech.ts";

describe("read-along mic session", () => {
  it("does not stop the mic after a correct match", () => {
    const next = micAfterCorrectMatch("live");
    assert.equal(next.intent, "live");
    assert.equal(next.command, "none");
  });

  it("keeps the mic on after a miss so the reader can retry", () => {
    const next = micAfterMiss("live");
    assert.equal(next.intent, "live");
    assert.equal(next.command, "none");
  });

  it("pauses the mic only while TTS is speaking", () => {
    const next = micPauseForTts("live");
    assert.equal(next.intent, "paused");
    assert.equal(next.command, "stop");
    const off = micPauseForTts("off");
    assert.equal(off.intent, "off");
    assert.equal(off.command, "none");
  });

  it("restarts immediately when Chrome ends a live session", () => {
    assert.equal(micAfterRecognitionEnded("live"), "restart");
  });

  it("does not restart while paused for TTS", () => {
    assert.equal(micAfterRecognitionEnded("paused"), "stay_off");
    assert.equal(micAfterRecognitionEnded("off"), "stay_off");
  });

  it("resumes listening after help finishes", () => {
    const next = micAfterHelpFinished("paused");
    assert.equal(next.intent, "live");
    assert.equal(next.command, "start");
  });

  it("stays off when the user tapped Stop", () => {
    const next = micAfterUserStop();
    assert.equal(next.intent, "off");
    assert.equal(next.command, "stop");
  });
});

describe("planMissTry", () => {
  it("gives one unaided retry after the original miss", () => {
    const next = planMissTry(1, "forest,");
    assert.equal(next.kind, "unaided_retry");
    assert.equal(next.spokenWord, "forest");
  });

  it("speaks the word and stays after the unaided retry fails", () => {
    const next = planMissTry(2, "forest");
    assert.equal(next.kind, "tts_then_listen");
    assert.equal(next.spokenWord, "forest");
  });

  it("speaks again, marks helped, and skips after the third miss", () => {
    const next = planMissTry(3, "forest");
    assert.equal(next.kind, "tts_then_skip");
    assert.equal(next.result, "helped");
    assert.equal(next.spokenWord, "forest");
  });
});

describe("hasNewUnmatchedSpeech", () => {
  it("ignores leftover transcript after a successful match", () => {
    assert.equal(hasNewUnmatchedSpeech("the cat sat", "the cat sat"), false);
  });

  it("treats extra tokens after the last match as new speech", () => {
    assert.equal(hasNewUnmatchedSpeech("the cat sat on", "the cat sat"), true);
  });

  it("treats a fresh recognition session as new speech", () => {
    assert.equal(hasNewUnmatchedSpeech("mat", "the cat sat"), true);
  });

  it("ignores empty transcripts", () => {
    assert.equal(hasNewUnmatchedSpeech("", "the cat"), false);
    assert.equal(hasNewUnmatchedSpeech("   ", ""), false);
  });
});
