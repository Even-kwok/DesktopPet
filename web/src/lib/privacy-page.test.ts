import test from "node:test";
import assert from "node:assert/strict";
import {
  privacyBoundaryItems,
  privacyMetadata,
  privacySections
} from "./privacy-page.ts";

test("privacy copy states the public route and core data boundaries", () => {
  assert.deepEqual(privacyMetadata, {
    path: "/privacy",
    title: "隐私说明",
    lastUpdated: "2026-06-26"
  });

  const copy = [
    ...privacyBoundaryItems,
    ...privacySections.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.items ?? [])
    ])
  ].join("\n");

  for (const phrase of [
    "桌面端只同步猫咪资料、动作素材、寄养状态和必要的账号摘要",
    "不会读取你的屏幕内容",
    "不会记录键盘输入",
    "不会扫描本地文件",
    "不会读取你打开了哪些应用或窗口"
  ]) {
    assert.match(copy, new RegExp(escapeRegExp(phrase)));
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
