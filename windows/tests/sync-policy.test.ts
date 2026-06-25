import assert from "node:assert/strict";
import test from "node:test";
import { replacementWarningDialogOptions } from "../src/main/sync-policy.ts";

test("builds Mac-parity local material replacement warning copy", () => {
  const replacements = [
    "栗子 · 待机循环",
    "栗子 · 点击反应",
    "栗子 · 开心",
    "团子 · 待机循环",
    "团子 · 睡觉",
    "团子 · 打哈欠",
    "雪球 · 待机循环",
    "雪球 · 点击反应"
  ];

  assert.deepEqual(replacementWarningDialogOptions(replacements), {
    type: "warning",
    buttons: ["继续同步", "先不覆盖"],
    defaultId: 0,
    cancelId: 1,
    title: "同步会替换本地动作",
    message: "同步会替换本地动作",
    detail:
      "栗子 · 待机循环\n" +
      "栗子 · 点击反应\n" +
      "栗子 · 开心\n" +
      "团子 · 待机循环\n" +
      "团子 · 睡觉\n" +
      "团子 · 打哈欠\n" +
      "还有 2 个动作也会被替换。\n\n" +
      "继续同步后，这些位置会使用网页端最新素材。"
  });
});
