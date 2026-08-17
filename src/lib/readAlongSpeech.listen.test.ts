import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPEECH_LOCALE,
  TTS_RATE_DEFAULT,
  TTS_RATE_MAX,
  TTS_RATE_MIN,
  advanceCreditedTranscript,
  clampTtsRate,
  configureReadAlongRecognition,
  farthestMatchedIndex,
  hasNewUnmatchedSpeech,
  listEnglishVoices,
  micAfterCorrectMatch,
  micAfterHelpFinished,
  micAfterMiss,
  micAfterRecognitionEnded,
  micAfterUserStop,
  micPauseForTts,
  MIC_RESTART_DEBOUNCE_MS,
  parseTtsRate,
  pickTtsVoice,
  planMissTry,
  preferUsEnglishVoice,
  remainingStoryWords,
  shouldDeferMicRestart,
  storyIndexAtNarrationChar,
  storyNarrationChunks,
  ttsRateForPreset,
  unmatchedTranscript,
  wordsMatch,
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

  it("mutes analysis during TTS without stopping the recognizer", () => {
    const next = micPauseForTts("live");
    assert.equal(next.intent, "paused");
    assert.equal(next.command, "none");
    const off = micPauseForTts("off");
    assert.equal(off.intent, "off");
    assert.equal(off.command, "none");
  });

  it("restarts only when Play is still on and Chrome ended the engine", () => {
    assert.equal(micAfterRecognitionEnded("live"), "restart");
    assert.equal(micAfterRecognitionEnded("paused"), "restart");
    assert.equal(micAfterRecognitionEnded("off"), "stay_off");
  });

  it("unmutes after TTS without calling start again", () => {
    const next = micAfterHelpFinished("paused");
    assert.equal(next.intent, "live");
    assert.equal(next.command, "none");
    const live = micAfterHelpFinished("live");
    assert.equal(live.command, "none");
  });

  it("stays off when the user tapped Pause", () => {
    const next = micAfterUserStop();
    assert.equal(next.intent, "off");
    assert.equal(next.command, "stop");
  });

  it("defers a restart while start is already in flight or inside the debounce window", () => {
    assert.equal(
      shouldDeferMicRestart({
        alreadyStarting: true,
        lastStartAt: 0,
        now: 10_000,
      }),
      true,
    );
    assert.equal(
      shouldDeferMicRestart({
        alreadyStarting: false,
        lastStartAt: 1000,
        now: 1000 + 200,
      }),
      true,
    );
    assert.equal(
      shouldDeferMicRestart({
        alreadyStarting: false,
        lastStartAt: 1000,
        now: 1000 + MIC_RESTART_DEBOUNCE_MS,
      }),
      false,
    );
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
    // "the" was said, so credit current "the" — do not jump to the later "the"
    assert.equal(farthestMatchedIndex("on the mat", LINE, 0), 0);
  });

  it("credits the current word when extra words surround it", () => {
    assert.equal(farthestMatchedIndex("um a tin can hey", ["tin", "can"], 0), 1);
    assert.equal(farthestMatchedIndex("hey the tin", ["tin", "the"], 0), 0);
  });

  it("credits a then tin then can from hey a tin can", () => {
    assert.equal(farthestMatchedIndex("hey a tin can", ["a", "tin", "can"], 0), 2);
  });

  it("stops when the middle unread word was not said", () => {
    assert.equal(farthestMatchedIndex("the sat", LINE, 0), 0);
    assert.equal(farthestMatchedIndex("hey a can", ["a", "tin", "can"], 0), 0);
  });

  it("skips punctuation-only tokens in the lookahead window", () => {
    const words = ["The", "cat", "—", "sat", "on"];
    assert.equal(farthestMatchedIndex("the cat sat", words, 0), 3);
  });

  it("stops at the first unread word and does not mark skipped middle words", () => {
    assert.equal(farthestMatchedIndex("the cat", LINE, 0), 1);
    assert.equal(farthestMatchedIndex("the on", LINE, 0), 0);
  });

  it("credits American English article a when ASR hears uh/ah/ay/uhh", () => {
    const words = ["a", "tin", "can"];
    assert.equal(farthestMatchedIndex("uh", words, 0), 0);
    assert.equal(farthestMatchedIndex("ah tin", words, 0), 1);
    assert.equal(farthestMatchedIndex("ay tin can", words, 0), 2);
    assert.equal(farthestMatchedIndex("uhh tin", words, 0), 1);
  });

  it("skips a dropped article a when the next word already matched", () => {
    const words = ["a", "tin", "can"];
    assert.equal(farthestMatchedIndex("tin", words, 0), 1);
    assert.equal(farthestMatchedIndex("tin can", words, 0), 2);
  });

  it("does not skip unread words after a just because a later word matched", () => {
    const words = ["a", "cat", "tin"];
    assert.equal(farthestMatchedIndex("tin", words, 0), -1);
    assert.equal(farthestMatchedIndex("sat", words, 0), -1);
  });

  it("credits tin when ASR hears tin/tinn/tyn/ten/in only for that target", () => {
    const words = ["the", "tin", "can"];
    assert.equal(farthestMatchedIndex("tin", words, 1), 1);
    assert.equal(farthestMatchedIndex("tinn", words, 1), 1);
    assert.equal(farthestMatchedIndex("tyn", words, 1), 1);
    assert.equal(farthestMatchedIndex("ten", words, 1), 1);
    assert.equal(farthestMatchedIndex("in", words, 1), 1);
    assert.equal(farthestMatchedIndex("tin.", words, 1), 1);
  });

  it("does not treat heard in as tin when the unread word is in", () => {
    const words = ["go", "in", "the"];
    assert.equal(farthestMatchedIndex("in", words, 1), 1);
    assert.equal(farthestMatchedIndex("tin", words, 1), -1);
  });
});

describe("wordsMatch target aliases", () => {
  it("accepts common ASR variants for article a", () => {
    assert.equal(wordsMatch("a", "a"), true);
    assert.equal(wordsMatch("a", "uh"), true);
    assert.equal(wordsMatch("a", "ah"), true);
    assert.equal(wordsMatch("a", "ay"), true);
    assert.equal(wordsMatch("a", "uhh"), true);
    assert.equal(wordsMatch("a", "cat"), false);
    assert.equal(wordsMatch("a", "the"), false);
  });

  it("accepts tin aliases only when the expected word is tin", () => {
    assert.equal(wordsMatch("tin", "tin"), true);
    assert.equal(wordsMatch("tin", "tinn"), true);
    assert.equal(wordsMatch("tin", "tyn"), true);
    assert.equal(wordsMatch("tin", "ten"), true);
    assert.equal(wordsMatch("tin", "in"), true);
    assert.equal(wordsMatch("tin", "tin."), true);
    assert.equal(wordsMatch("in", "in"), true);
    assert.equal(wordsMatch("in", "tin"), false);
    assert.equal(wordsMatch("ten", "tin"), false);
  });
});

describe("wordsMatch kid pronunciation", () => {
  it("accepts goin for going and runnin for running", () => {
    assert.equal(wordsMatch("going", "goin"), true);
    assert.equal(wordsMatch("running", "runnin"), true);
  });

  it("accepts da/duh for the and wif for with", () => {
    assert.equal(wordsMatch("the", "da"), true);
    assert.equal(wordsMatch("the", "duh"), true);
    assert.equal(wordsMatch("with", "wif"), true);
    assert.equal(wordsMatch("them", "dem"), true);
    assert.equal(wordsMatch("that", "dat"), true);
    assert.equal(wordsMatch("this", "dis"), true);
  });

  it("accepts a 4-letter word off by one letter", () => {
    assert.equal(wordsMatch("jump", "jomp"), true);
    assert.equal(wordsMatch("frog", "frig"), true);
  });

  it("accepts contractions without apostrophes", () => {
    assert.equal(wordsMatch("I'm", "im"), true);
    assert.equal(wordsMatch("don't", "dont"), true);
  });

  it("does not let short function words collapse into each other", () => {
    assert.equal(wordsMatch("a", "the"), false);
    assert.equal(wordsMatch("and", "an"), false);
    assert.equal(wordsMatch("cat", "sat"), false);
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

describe("read-aloud TTS settings", () => {
  it("clamps rate to the kid-friendly range", () => {
    assert.equal(clampTtsRate(0.2), TTS_RATE_MIN);
    assert.equal(clampTtsRate(2), TTS_RATE_MAX);
    assert.equal(clampTtsRate(1), 1);
    assert.equal(parseTtsRate("nope"), TTS_RATE_DEFAULT);
  });

  it("maps slow/normal/fast presets", () => {
    assert.equal(ttsRateForPreset("slow"), 0.7);
    assert.equal(ttsRateForPreset("normal"), TTS_RATE_DEFAULT);
    assert.equal(ttsRateForPreset("fast"), 1.25);
  });

  it("lists English voices first and picks a saved URI before en-US default", () => {
    const voices = [
      { lang: "es-ES", name: "Monica", voiceURI: "es" },
      { lang: "en-GB", name: "Daniel", voiceURI: "gb" },
      { lang: "en-US", name: "Samantha", voiceURI: "us" },
    ];
    const listed = listEnglishVoices(voices);
    assert.equal(listed[0]?.voiceURI, "gb");
    assert.equal(listed[1]?.voiceURI, "us");
    assert.equal(pickTtsVoice(voices, "gb")?.voiceURI, "gb");
    assert.equal(pickTtsVoice(voices, "")?.voiceURI, "us");
  });

  it("speaks remaining story words from the current highlight", () => {
    assert.deepEqual(remainingStoryWords(["a", "tin", "can"], 1), [
      "tin",
      "can",
    ]);
    assert.deepEqual(remainingStoryWords(["a", "tin"], 0), ["a", "tin"]);
  });

  it("builds story-style sentence chunks instead of isolated words", () => {
    const words = ["Joyella", "found", "a", "tin.", "Then", "she", "ran."];
    const chunks = storyNarrationChunks(words, 0);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.text, "Joyella found a tin. Then she ran.");
    assert.equal(chunks[0]?.startStoryIndex, 0);
    assert.equal(
      chunks.some((chunk) => chunk.text === "Joyella"),
      false,
    );
  });

  it("starts the first chunk at the current highlight, even mid-sentence", () => {
    const words = ["Joyella", "found", "a", "tin.", "Then", "she", "ran."];
    const chunks = storyNarrationChunks(words, 2);
    assert.equal(chunks[0]?.text, "a tin. Then she ran.");
    assert.equal(chunks[0]?.startStoryIndex, 2);
  });

  it("maps a spoken-text char offset back to the story word index", () => {
    const text = "a tin.";
    assert.equal(storyIndexAtNarrationChar(text, 0, 2), 2);
    assert.equal(storyIndexAtNarrationChar(text, 2, 2), 3);
  });

  it("packs short sentences into one paragraph utterance", () => {
    const words = [
      "The",
      "cat",
      "sat.",
      "The",
      "cat",
      "ran.",
      "Then",
      "it",
      "rested.",
    ];
    const chunks = storyNarrationChunks(words, 0);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.text, "The cat sat. The cat ran. Then it rested.");
  });

  it("starts a new paragraph chunk after the word cap without splitting a sentence", () => {
    const sentence = ["One", "two", "three", "four", "five", "six", "seven."];
    const words = [...sentence, ...sentence, ...sentence, ...sentence, ...sentence, ...sentence];
    const chunks = storyNarrationChunks(words, 0);
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0]?.text.endsWith("seven."), true);
    assert.equal(chunks[0]?.text.includes(" "), true);
    assert.ok((chunks[0]?.tokenCount ?? 0) <= 42);
  });
});
