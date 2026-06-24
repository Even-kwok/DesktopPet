import assert from "node:assert/strict";
import test from "node:test";
import {
  existingInstanceReopenActions,
  initialLaunchActions,
  singleInstanceStartupPlan,
  systemWakeActions
} from "../src/main/app-lifecycle-policy.ts";

test("quits a duplicate Windows app instance before bootstrapping", () => {
  assert.deepEqual(singleInstanceStartupPlan(false), { shouldBootstrap: false, shouldQuit: true });
  assert.deepEqual(singleInstanceStartupPlan(true), { shouldBootstrap: true, shouldQuit: false });
});

test("reopens the existing instance like the Mac dock reopen path", () => {
  assert.deepEqual(existingInstanceReopenActions(), ["resumePets", "showStudio", "refreshTray"]);
});

test("starts like the Mac app by opening Studio without the first-run import prompt", () => {
  assert.deepEqual(initialLaunchActions(), {
    showStudio: true,
    showsFirstRunPrompt: false
  });
});

test("refreshes the tray after Windows wake like the Mac menu refresh path", () => {
  assert.deepEqual(systemWakeActions(), ["resumePets", "refreshTray"]);
});
