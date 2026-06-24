import assert from "node:assert/strict";
import test from "node:test";
import { runStudioAction } from "../src/renderer/studio/studio-action-runner.ts";

test("refreshes Studio state after an action fails so partial sync side effects are visible", async () => {
  const events: string[] = [];
  let statusMessage = "";

  await runStudioAction({
    action: async () => {
      events.push("action");
      throw new Error("网页端还没有可同步的视频素材。");
    },
    refreshState: async (actionResult) => {
      events.push(actionResult === undefined ? "refresh:latest-state" : "refresh:action-result");
    },
    setStatusMessage: (message) => {
      statusMessage = message;
      events.push(`status:${message}`);
    },
    successMessage: "已同步网页端素材。"
  });

  assert.deepEqual(events, [
    "action",
    "refresh:latest-state",
    "status:网页端还没有可同步的视频素材。"
  ]);
  assert.equal(statusMessage, "网页端还没有可同步的视频素材。");
});
