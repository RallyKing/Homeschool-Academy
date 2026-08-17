import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReadAlongRecipePrompt,
  recipeUsesCustomPrompt,
  SPOKEN_CONTEXT_PROMPT_RULES,
} from "../../convex/lib/readAlongPrompt.ts";
import {
  findSpokenContextIssues,
  storyHasSpokenContext,
} from "../../convex/lib/readAlongSpokenContext.ts";

describe("storyHasSpokenContext", () => {
  it("fails a bare article + short noun with no following collocation", () => {
    assert.equal(storyHasSpokenContext("a tin"), false);
    assert.equal(storyHasSpokenContext("A tin."), false);
    const issues = findSpokenContextIssues("There was a tin.");
    assert.ok(issues.length > 0);
    assert.ok(issues.some((issue) => /tin/i.test(issue)));
  });

  it("passes when the short noun has a neighboring content word", () => {
    assert.equal(storyHasSpokenContext("a tin can"), true);
    assert.equal(storyHasSpokenContext("Sam picked up a tin can."), true);
    assert.equal(storyHasSpokenContext("There was a tin box."), true);
    assert.equal(findSpokenContextIssues("a tin can").length, 0);
  });

  it("fails a stranded article with no noun phrase", () => {
    assert.equal(storyHasSpokenContext("She wanted a."), false);
    assert.equal(storyHasSpokenContext("He looked at the."), false);
  });

  it("passes a full sentence where articles attach to noun phrases", () => {
    const body =
      "Sam picked up a tin can from the shelf and poured water into a tin cup.";
    assert.equal(storyHasSpokenContext(body), true);
  });

  it("allows a function word when a noun follows after a short article", () => {
    assert.equal(storyHasSpokenContext("It's for a kitchen project."), true);
  });
});

describe("buildReadAlongRecipePrompt spoken context", () => {
  it("encodes hard rules so every word has neighboring speech context", () => {
    const prompt = buildReadAlongRecipePrompt({
      gradeLevel: "1st grade",
      theme: "kitchen helpers",
      moralLessons: ["share"],
      length: "short",
    });
    assert.match(prompt, /tin can/i);
    assert.match(prompt, /spoken context|speech recognizer/i);
    assert.match(prompt, /never end a sentence/i);
    assert.match(prompt, /\ba, an, the\b/i);
    assert.match(prompt, /1–2 word sentences|1-2 word sentences/i);
    assert.match(prompt, /collocation/i);
    assert.match(prompt, /glossary/i);
  });

  it("does not treat a legacy auto prompt as a custom override", () => {
    const input = {
      gradeLevel: "1st grade",
      theme: "kitchen helpers",
      moralLessons: ["share"],
      length: "short" as const,
    };
    const auto = buildReadAlongRecipePrompt(input);
    const legacy = auto.replace(SPOKEN_CONTEXT_PROMPT_RULES, "").trim();
    assert.equal(recipeUsesCustomPrompt(auto, auto), false);
    assert.equal(recipeUsesCustomPrompt(legacy, auto), false);
    assert.equal(
      recipeUsesCustomPrompt("Write a totally custom kitchen tale.", auto),
      true,
    );
  });
});
