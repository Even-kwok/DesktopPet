import assert from "node:assert/strict";
import test from "node:test";
import {
  idleLoopImportTargetAfterAddingPet,
  localVideoPickerOptions,
  localVideoRemovalAction,
  petCountAfterLocalVideoImport
} from "../src/main/local-import-policy.ts";

test("grows pet count when importing an idle loop for an inactive pet slot", () => {
  assert.equal(petCountAfterLocalVideoImport(0, 0, "idle_loop"), 1);
  assert.equal(petCountAfterLocalVideoImport(1, 2, "idle_loop"), 3);
});

test("keeps pet count unchanged for non-idle local material imports", () => {
  assert.equal(petCountAfterLocalVideoImport(0, 0, "click_react"), 0);
  assert.equal(petCountAfterLocalVideoImport(2, 0, "sleep_loop"), 2);
});

test("reshows visible pets after removing an idle-loop video", () => {
  assert.equal(localVideoRemovalAction("idle_loop", true), "showAll");
  assert.equal(localVideoRemovalAction("idle_loop", false), "refreshPlayback");
  assert.equal(localVideoRemovalAction("click_react", true), "refreshPlayback");
});

test("requests idle-loop import for the pet added from the tray", () => {
  assert.deepEqual(idleLoopImportTargetAfterAddingPet(2), {
    petIndex: 2,
    slot: "idle_loop"
  });
});

test("builds Mac-parity local video picker copy", () => {
  assert.deepEqual(localVideoPickerOptions("栗子", "待机循环"), {
    title: "选择 栗子 的「待机循环」视频",
    buttonLabel: "选择",
    properties: ["openFile"],
    filters: [{ name: "Video", extensions: ["mp4", "mov"] }]
  });
});
