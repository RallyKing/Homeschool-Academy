import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpeechTicketPrompt } from "../../convex/lib/speechTicketPrompt.ts";

describe("buildSpeechTicketPrompt", () => {
  it("builds a Cursor-ready prompt from the word and ASR samples", () => {
    const prompt = buildSpeechTicketPrompt({
      word: "tin",
      heardAs: ["ten", "in"],
      notes: "Chrome on Windows",
    });
    assert.match(prompt.title, /tin/i);
    assert.match(prompt.body, /readAlongSpeech\.ts/);
    assert.match(prompt.body, /ten/);
    assert.match(prompt.body, /Chrome on Windows/);
    assert.match(prompt.body, /add tests/i);
  });
});
