import assert from "node:assert/strict";
import test from "node:test";
import { planPetWindowWakeResume } from "../src/main/pet-window-wake-policy.ts";

test("keeps hidden pet windows hidden after system wake", () => {
  assert.deepEqual(
    planPetWindowWakeResume({
      isVisible: false
    }),
    {
      shouldShowWindow: false,
      shouldReplayCurrentState: false
    }
  );
});

test("restores visible pet windows without resetting the state machine", () => {
  const plan = planPetWindowWakeResume({
    isVisible: true
  });

  assert.deepEqual(plan, {
    shouldShowWindow: true,
    shouldReplayCurrentState: true
  });
  assert.equal("stateMachineEvent" in plan, false);
});
