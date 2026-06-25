import assert from "node:assert/strict";
import test from "node:test";
import {
  pendingStatusMessageForImportVideoAction,
  pendingStatusMessageForSignInAction,
  pendingStatusMessageForSyncAction,
  statusMessageForImportVideoAction,
  statusMessageForRemoveVideoAction,
  statusMessageForSignInAction,
  statusMessageForSignOutAction,
  statusMessageForSyncAction,
  statusMessageForActionResult
} from "../src/renderer/studio/studio-action-result.ts";

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

test("uses Mac-parity copy for local video import results", () => {
  assert.equal(
    statusMessageForImportVideoAction("待机循环", { result: { warningMessages: [] } }),
    "已导入「待机循环」本地视频。"
  );
  assert.equal(
    statusMessageForImportVideoAction("点击互动", {
      result: { warningMessages: ["这段视频有点长，作为桌宠动作可能不够轻快。"] }
    }),
    "已导入「点击互动」本地视频。 这段视频有点长，作为桌宠动作可能不够轻快。"
  );
});

test("uses Mac-parity pending copy for local video import", () => {
  assert.equal(pendingStatusMessageForImportVideoAction("待机循环"), "正在检查「待机循环」视频...");
});

test("uses Mac-parity copy for local video removal results", () => {
  assert.equal(statusMessageForRemoveVideoAction("点击互动"), "已移除「点击互动」本地视频。");
});

test("uses Mac-parity copy for account sign-in success", () => {
  assert.equal(statusMessageForSignInAction(), "登录成功。点击同步获取账号下的猫咪。");
});

test("uses Mac-parity copy for account sign-out success", () => {
  assert.equal(statusMessageForSignOutAction(), "已退出账号。本地已同步的猫咪资料和视频素材已保留。");
});

test("uses Mac-parity copy for desktop sync results", () => {
  assert.equal(
    statusMessageForSyncAction({ summary: { petCount: 2, materialCount: 9 } }),
    "已从网页同步 2 只宠物、9 个动作素材。"
  );
  assert.equal(statusMessageForSyncAction({ canceled: true }), "已取消同步，本地动作保持不变。");
});

test("falls back for malformed desktop sync summaries", () => {
  assert.equal(
    statusMessageForSyncAction({ summary: { petCount: Number.NaN, materialCount: 9 } }),
    "已同步网页端素材。"
  );
  assert.equal(
    statusMessageForSyncAction({ summary: { petCount: 2, materialCount: Number.POSITIVE_INFINITY } }),
    "已同步网页端素材。"
  );
  assert.equal(
    statusMessageForSyncAction({ summary: { petCount: -1, materialCount: 9 } }),
    "已同步网页端素材。"
  );
});

test("uses Mac-parity pending copy for desktop sync", () => {
  assert.equal(pendingStatusMessageForSyncAction(), "正在从网页同步生成好的素材...");
});

test("uses Mac-parity pending copy for account actions", () => {
  assert.equal(pendingStatusMessageForSignInAction(), "正在登录账号...");
});
