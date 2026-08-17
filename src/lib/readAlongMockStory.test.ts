import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockReadAlongStory } from "../../convex/lib/readAlongMockStory.ts";
import { findSpokenContextIssues } from "../../convex/lib/readAlongSpokenContext.ts";

describe("mockReadAlongStory recipe selection", () => {
  it("uses the selected recipe title instead of The Garden Map", () => {
    const story = mockReadAlongStory({
      displayName: "Jordan",
      ageBand: "elementary",
      subject: "getting along at home",
      recipeTitle: "Dealing with sister",
    });
    assert.notEqual(story.title.toLowerCase(), "the garden map");
    assert.match(story.title, /dealing with sister/i);
    assert.match(story.body, /sister|getting along at home/i);
    assert.equal(findSpokenContextIssues(story.body).length, 0);
  });

  it("keeps the default garden map only when no recipe was chosen", () => {
    const story = mockReadAlongStory({
      displayName: "Jordan",
      ageBand: "elementary",
    });
    assert.equal(story.title, "The Garden Map");
  });
});
