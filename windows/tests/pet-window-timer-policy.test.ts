import assert from "node:assert/strict";
import test from "node:test";
import { planTimedPetWindowAction } from "../src/main/pet-window-timer-policy.ts";

test("skips timed sleep when the sleep video was removed before the timer fired", () => {
  assert.deepEqual(
    planTimedPetWindowAction({
      state: "idle",
      hasAvailableVideo: false,
      hasFrame: true,
      isVisible: true,
      isCursorNearPet: false,
      stateMachineEvent: "sleep"
    }),
    { action: "ignore" }
  );
});

test("skips timed idle random action when all idle action videos were removed before the timer fired", () => {
  assert.deepEqual(
    planTimedPetWindowAction({
      state: "idle",
      hasAvailableVideo: false,
      hasFrame: true,
      isVisible: true,
      isCursorNearPet: false,
      stateMachineEvent: "idleActionDue"
    }),
    { action: "ignore" }
  );
});

test("reschedules timed pet actions while the cursor is still near the pet", () => {
  assert.deepEqual(
    planTimedPetWindowAction({
      state: "idle",
      hasAvailableVideo: true,
      hasFrame: true,
      isVisible: true,
      isCursorNearPet: true,
      stateMachineEvent: "sleep"
    }),
    { action: "reschedule" }
  );
});

test("sends the requested state-machine event when timed pet actions are still eligible", () => {
  assert.deepEqual(
    planTimedPetWindowAction({
      state: "idle",
      hasAvailableVideo: true,
      hasFrame: true,
      isVisible: true,
      isCursorNearPet: false,
      stateMachineEvent: "idleActionDue"
    }),
    { action: "send", stateMachineEvent: "idleActionDue" }
  );
});
