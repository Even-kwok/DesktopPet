import assert from "node:assert/strict";
import test from "node:test";
import { planPetWindowPlaybackRefresh } from "../src/main/pet-window-playback-policy.ts";

test("skips playback refresh for hidden pet windows like the Mac controller guard", () => {
  assert.deepEqual(
    planPetWindowPlaybackRefresh({
      isVisible: false
    }),
    { shouldReplayCurrentState: false }
  );
});

test("replays the current state when a pet window is visible", () => {
  assert.deepEqual(
    planPetWindowPlaybackRefresh({
      isVisible: true
    }),
    { shouldReplayCurrentState: true }
  );
});
