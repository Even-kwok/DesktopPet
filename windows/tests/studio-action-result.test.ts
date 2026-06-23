import assert from "node:assert/strict";
import test from "node:test";
import { statusMessageForActionResult } from "../src/renderer/studio/studio-action-result.ts";

test("keeps success message for normal studio actions", () => {
  assert.equal(statusMessageForActionResult(undefined, "已同步网页端素材。"), "已同步网页端素材。");
  assert.equal(statusMessageForActionResult({ petIndex: 2 }, "已添加宠物。"), "已添加宠物。");
});

test("uses cancellation copy when a studio action is canceled", () => {
  assert.equal(statusMessageForActionResult({ canceled: true }, "已同步网页端素材。"), "已取消。");
  assert.equal(
    statusMessageForActionResult({ result: { canceled: true } }, "已导入「待机循环」。"),
    "已取消。"
  );
});
