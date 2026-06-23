import assert from "node:assert/strict";
import test from "node:test";
import { petCountAfterLocalVideoImport } from "../src/main/local-import-policy.ts";

test("grows pet count when importing an idle loop for an inactive pet slot", () => {
  assert.equal(petCountAfterLocalVideoImport(0, 0, "idle_loop"), 1);
  assert.equal(petCountAfterLocalVideoImport(1, 2, "idle_loop"), 3);
});

test("keeps pet count unchanged for non-idle local material imports", () => {
  assert.equal(petCountAfterLocalVideoImport(0, 0, "click_react"), 0);
  assert.equal(petCountAfterLocalVideoImport(2, 0, "sleep_loop"), 2);
});
