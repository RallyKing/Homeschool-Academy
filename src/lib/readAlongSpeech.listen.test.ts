import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPEECH_LOCALE,
  advanceCreditedTranscript,
  configureReadAlongRecognition,
  farthestMatchedIndex,
  hasNewUnmatchedSpeech,
  micAfterCorrectMatch,
  micAfterHelpFinished,
  micAfterMiss,
  micAfterRecognitionEnded,
  micAfterUserStop,
  micPauseForTts,
  planMissTry,
  preferUsEnglishVoice,
  unmatchedTranscript,
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

const LINE = ["the", "cat", "sat", "on", "the", "mat"];

describe("farthestMatchedIndex sequential lookahead", () => {
  it("credits a single current word", () => {
    assert.equal(farthestMatchedIndex("the", LINE, 0), 0);
  });

  it("credits a 3-word fast phrase and stops after the last heard word", () => {
    assert.equal(farthestMatchedIndex("the cat sat", LINE, 0), 2);
  });

  it("caps a burst at 5 readable words and does not eat the 6th", () => {
    assert.equal(farthestMatchedIndex("the cat sat on the mat", LINE, 0), 4);
  });

  it("does not skip the current word to match a later duplicate", () => {
    assert.equal(farthestMatchedIndex("the", LINE, 0), 0);
    assert.equal(farthestMatchedIndex("sat", LINE, 0), -1);
    assert.equal(farthestMatchedIndex("on the mat", LINE, 0), -1);
  });

  it("skips punctuation-only tokens in the lookahead window", () => {
    const words = ["The", "cat", "—", "sat", "on"];
    assert.equal(farthestMatchedIndex("the cat sat", words, 0), 3);
  });

  it("stops at the first unread word and does not mark skipped middle words", () => {
    assert.equal(farthestMatchedIndex("the cat", LINE, 0), 1);
    assert.equal(farthestMatchedIndex("the on", LINE, 0), 0);
  });
});

describe("unmatchedTranscript", () => {
  it("returns only speech after the last credited match", () => {
    assert.equal(unmatchedTranscript("the cat sat on", "the cat sat"), "on");
  });

  it("returns nothing when the leftover transcript was already processed", () => {
    assert.equal(unmatchedTranscript("the cat sat", "the cat sat"), "");
  });

  it("returns a fresh recognition session in full", () => {
    assert.equal(unmatchedTranscript("mat", "the cat sat"), "mat");
  });
});

describe("advanceCreditedTranscript", () => {
  it("keeps leftover tokens after a 5-word cap so the next unread word can match", () => {
    assert.equal(
      advanceCreditedTranscript("the cat sat on the mat", "", 5),
      "the cat sat on the",
    );
    assert.equal(
      unmatchedTranscript("the cat sat on the mat", "the cat sat on the"),
      "mat",
    );
  });
});

describe("American English speech", () => {
  it("targets en-US for recognition and TTS", () => {
    assert.equal(SPEECH_LOCALE, "en-US");
    const rec = {
      lang: "",
      continuous: false,
      interimResults: false,
      maxAlternatives: 1,
    };
    configureReadAlongRecognition(rec);
    assert.equal(rec.lang, "en-US");
    assert.equal(rec.continuous, true);
    assert.equal(rec.interimResults, true);
  });

  it("prefers a US English voice over British or other English", () => {
    const picked = preferUsEnglishVoice([
      { lang: "en-GB", name: "Daniel" },
      { lang: "en-US", name: "Samantha" },
      { lang: "en-AU", name: "Karen" },
    ]);
    assert.equal(picked?.lang, "en-US");
    assert.equal(picked?.name, "Samantha");
  });

  it("returns null when no US English voice is installed", () => {
    assert.equal(
      preferUsEnglishVoice([{ lang: "en-GB", name: "Daniel" }]),
      null,
    );
  });
});
