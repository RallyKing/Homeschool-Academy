import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEAVE_STORY_PROMPT,
  MIC_PLAY_LABEL,
  MIC_PAUSE_LABEL,
  micControlLabel,
  requestLeaveReadAlong,
  shouldConfirmLeaveReadAlong,
} from "./leaveReadAlong.ts";

describe("shouldConfirmLeaveReadAlong", () => {
  it("confirms while a story is in progress or in practice", () => {
    assert.equal(shouldConfirmLeaveReadAlong("in_progress"), true);
    assert.equal(shouldConfirmLeaveReadAlong("practice"), true);
  });

  it("skips confirm after the session is finished", () => {
    assert.equal(shouldConfirmLeaveReadAlong("completed"), false);
  });
});

describe("requestLeaveReadAlong", () => {
  it("asks before leaving an in-progress story", () => {
    const prompts: string[] = [];
    const left = requestLeaveReadAlong({
      status: "in_progress",
      confirm: (message) => {
        prompts.push(message);
        return true;
      },
    });
    assert.equal(left, true);
    assert.deepEqual(prompts, [LEAVE_STORY_PROMPT]);
  });

  it("stays on the story when the reader cancels", () => {
    const left = requestLeaveReadAlong({
      status: "practice",
      confirm: () => false,
    });
    assert.equal(left, false);
  });

  it("leaves a finished session without prompting", () => {
    let asked = false;
    const left = requestLeaveReadAlong({
      status: "completed",
      confirm: () => {
        asked = true;
        return false;
      },
    });
    assert.equal(left, true);
    assert.equal(asked, false);
  });
});

describe("micControlLabel", () => {
  it("shows Play when the mic is off", () => {
    assert.equal(micControlLabel(false), MIC_PLAY_LABEL);
  });

  it("shows Pause when the mic is listening", () => {
    assert.equal(micControlLabel(true), MIC_PAUSE_LABEL);
  });
});
