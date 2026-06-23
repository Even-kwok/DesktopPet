import assert from "node:assert/strict";
import test from "node:test";
import {
  firstRunIdleLoopPromptOptions,
  firstRunIdleLoopPromptPlan,
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

test("requests first-run idle-loop import only when no pet can be restored", () => {
  assert.deepEqual(
    firstRunIdleLoopPromptPlan({
      showsFirstRunPrompt: true,
      didRestoreVideo: false,
      hasFirstPetIdleLoop: false
    }),
    { shouldPrompt: true, petIndex: 0, slot: "idle_loop" }
  );
  assert.deepEqual(
    firstRunIdleLoopPromptPlan({
      showsFirstRunPrompt: true,
      didRestoreVideo: true,
      hasFirstPetIdleLoop: false
    }),
    { shouldPrompt: false }
  );
  assert.deepEqual(
    firstRunIdleLoopPromptPlan({
      showsFirstRunPrompt: true,
      didRestoreVideo: false,
      hasFirstPetIdleLoop: true
    }),
    { shouldPrompt: false }
  );
});

test("builds Mac-parity first-run idle-loop prompt copy", () => {
  assert.deepEqual(firstRunIdleLoopPromptOptions(), {
    type: "info",
    buttons: ["选择待机循环", "稍后"],
    defaultId: 0,
    cancelId: 1,
    message: "CatDesktopPet is running",
    detail: "请选择一个待机循环绿幕 MP4 或 MOV，宠物才会显示在桌面上。其他状态视频可以稍后从「选择状态视频」里添加。"
  });
});
