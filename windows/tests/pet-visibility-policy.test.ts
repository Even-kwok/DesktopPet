import assert from "node:assert/strict";
import test from "node:test";
import { showPetsActionPlan } from "../src/main/pet-visibility-policy.ts";

test("keeps pets visible when at least one pet can be shown", () => {
  assert.deepEqual(showPetsActionPlan(true), {
    isPetVisible: true,
    importIdleLoop: false
  });
});

test("requests idle-loop import when showing pets displays nothing", () => {
  assert.deepEqual(showPetsActionPlan(false), {
    isPetVisible: false,
    importIdleLoop: true,
    petIndex: 0,
    slot: "idle_loop"
  });
});
