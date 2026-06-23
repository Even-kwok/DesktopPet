import assert from "node:assert/strict";
import test from "node:test";
import {
  existingInstanceReopenActions,
  singleInstanceStartupPlan
} from "../src/main/app-lifecycle-policy.ts";

test("quits a duplicate Windows app instance before bootstrapping", () => {
  assert.deepEqual(singleInstanceStartupPlan(false), { shouldBootstrap: false, shouldQuit: true });
  assert.deepEqual(singleInstanceStartupPlan(true), { shouldBootstrap: true, shouldQuit: false });
});

test("reopens the existing instance like the Mac dock reopen path", () => {
  assert.deepEqual(existingInstanceReopenActions(), ["resumePets", "showStudio", "refreshTray"]);
});
