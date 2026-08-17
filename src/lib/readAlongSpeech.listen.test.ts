import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasNewUnmatchedSpeech,
  micAfterCorrectMatch,
  micAfterHelpFinished,
  micAfterMiss,
  micAfterRecognitionEnded,
  micAfterUserStop,
} from "./readAlongSpeech.ts";

describe("read-along mic session", () => {
  it("does not stop the mic after a correct match", () => {
    const next = micAfterCorrectMatch("live");
    assert.equal(next.intent, "live");
    assert.equal(next.command, "none");
  });

  it("stops the mic on a miss so the reader can get help", () => {
    const next = micAfterMiss("live");
    assert.equal(next.intent, "paused");
    assert.equal(next.command, "stop");
  });

  it("restarts immediately when Chrome ends a live session", () => {
    assert.equal(micAfterRecognitionEnded("live"), "restart");
  });

  it("does not restart while paused for a miss", () => {
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
