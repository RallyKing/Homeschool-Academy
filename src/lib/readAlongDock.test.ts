import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  READ_ALONG_DOCK_BACKUP,
  READ_ALONG_DOCK_HEAR_WORD,
  READ_ALONG_DOCK_NEXT,
  READ_ALONG_DOCK_READ_TO_ME,
  READ_ALONG_DOCK_SETTINGS,
  READ_ALONG_DOCK_STOP,
  readAlongStoryDockLabels,
} from "./readAlongDock.ts";
import { MIC_PAUSE_LABEL, MIC_PLAY_LABEL } from "./leaveReadAlong.ts";

describe("readAlongStoryDockLabels", () => {
  it("puts Read to me immediately after Hear this word, then Settings", () => {
    const labels = readAlongStoryDockLabels({
      micOk: true,
      listening: false,
      narrating: false,
    });
    assert.deepEqual(labels, [
      "Back",
      MIC_PLAY_LABEL,
      READ_ALONG_DOCK_BACKUP,
      READ_ALONG_DOCK_NEXT,
      READ_ALONG_DOCK_HEAR_WORD,
      READ_ALONG_DOCK_READ_TO_ME,
      READ_ALONG_DOCK_SETTINGS,
    ]);
    const hear = labels.indexOf(READ_ALONG_DOCK_HEAR_WORD);
    assert.equal(labels[hear + 1], READ_ALONG_DOCK_READ_TO_ME);
    assert.equal(labels[hear + 2], READ_ALONG_DOCK_SETTINGS);
  });

  it("keeps Read to me in the dock while narrating and while the mic is on", () => {
    const paused = readAlongStoryDockLabels({
      micOk: true,
      listening: true,
      narrating: true,
    });
    assert.equal(paused.includes(READ_ALONG_DOCK_READ_TO_ME), false);
    assert.ok(paused.includes(READ_ALONG_DOCK_STOP));
    assert.equal(
      paused.indexOf(READ_ALONG_DOCK_STOP),
      paused.indexOf(READ_ALONG_DOCK_HEAR_WORD) + 1,
    );
    assert.ok(paused.includes(MIC_PAUSE_LABEL));
  });
});
