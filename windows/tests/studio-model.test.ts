import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  accountDetail,
  accountDisplayName,
  canSubmitLogin,
  canSyncDesktopBundle,
  loginValidationMessage,
  loginPanelDetail,
  loginPanelTitle,
  localMaterialPreviewAction,
  localMaterialPreviewHint,
  localMaterialStatusText,
  localMaterialBoardDetail,
  localMaterialBoardTitle,
  syncedPetCardAction,
  syncedPetPanelDetail,
  syncedPetPanelEmptyDetail,
  syncedPetPanelEmptyTitle,
  syncedPetPanelTitle,
  statusTextForSyncedPet
} from "../src/shared/studio-model.ts";

const account = {
  id: "u1",
  name: "栗子主人",
  email: "demo@desktop.pet",
  credits: 120,
  accessToken: "token",
  signedInAt: "now"
};

test("builds account display copy", () => {
  assert.equal(accountDisplayName(undefined), "未登录");
  assert.equal(accountDetail(undefined), "登录后可同步网页端账号下的宠物数据。");
  assert.equal(accountDisplayName(account), "栗子主人");
  assert.equal(accountDetail(account), "demo@desktop.pet · 120 积分");
});

test("builds login panel copy for Windows", () => {
  assert.equal(loginPanelTitle(), "登录后同步你的猫咪");
  assert.equal(loginPanelDetail(), "Windows 端只负责显示和同步；素材生成放在网页端。");
});

test("gates login and desktop sync while pending", () => {
  assert.equal(canSubmitLogin("demo@desktop.pet", "123456"), true);
  assert.equal(canSubmitLogin("demo@desktop.pet", "123456", true), false);
  assert.equal(loginValidationMessage("   ", "123456"), "请输入邮箱和密码。");
  assert.equal(loginValidationMessage("demo@desktop.pet", ""), "请输入邮箱和密码。");
  assert.equal(loginValidationMessage("demo@desktop.pet", "123456"), undefined);

  assert.equal(canSyncDesktopBundle(undefined), false);
  assert.equal(canSyncDesktopBundle(account), true);
  assert.equal(canSyncDesktopBundle(account, true), false);
});

test("builds local material status and preview copy", () => {
  assert.equal(localMaterialStatusText({ hasVideo: true }), "已有视频");
  assert.equal(localMaterialStatusText({ hasVideo: false }), "未生成");
  assert.deepEqual(localMaterialPreviewAction({ hasVideo: false, isPreviewing: false }), {
    label: "预览",
    disabled: true
  });
  assert.deepEqual(localMaterialPreviewAction({ hasVideo: true, isPreviewing: true }), {
    label: "停止",
    disabled: false
  });
  assert.equal(localMaterialPreviewHint({ hasVideo: true }), "点预览播放");
  assert.equal(localMaterialBoardTitle(), "动作卡册");
  assert.equal(localMaterialBoardDetail(), "有素材的动作会在对应场景出现；点预览看看效果。");
});

test("builds synced pet panel copy and statuses", () => {
  assert.equal(syncedPetPanelTitle(), "我的猫咪");
  assert.equal(syncedPetPanelDetail(4), "4 只");
  assert.equal(syncedPetPanelEmptyTitle(), "还没有同步猫咪");
  assert.equal(syncedPetPanelEmptyDetail(), "点右上角同步，从网页端拉取账号下的猫咪和素材。");
  assert.equal(statusTextForSyncedPet({ ownership: "owned", displayState: "active" }), "在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "hosted", displayState: "active" }), "在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "away", displayState: "active" }), "暂不可显示");
  assert.equal(statusTextForSyncedPet({ ownership: "owned", displayState: "unavailable" }), "暂不可显示");
  assert.equal(statusTextForSyncedPet({ ownership: "owned", displayState: "hidden" }), "已隐藏");
});

test("only exposes selection actions for synced pet cards", () => {
  assert.deepEqual(
    syncedPetCardAction({ ownership: "owned", displayState: "active" }, false),
    { type: "select", label: "选择" }
  );
  assert.equal(syncedPetCardAction({ ownership: "owned", displayState: "active" }, true), undefined);
  assert.equal(syncedPetCardAction({ ownership: "away", displayState: "unavailable" }, true), undefined);
  assert.deepEqual(
    syncedPetCardAction({ ownership: "hosted", displayState: "active" }, false),
    { type: "select", label: "选择" }
  );
});

test("does not keep paused friend or hosting helpers in the Windows studio model", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/shared/studio-model.ts", import.meta.url)),
    "utf8"
  );

  assert.doesNotMatch(source, /friendPanel|friendEmail|FriendHosting|resolveFriend/);
  assert.doesNotMatch(source, /requestHosting|HostingRequest|recallPet|resolveRecall/);
  assert.doesNotMatch(source, /好友|寄养|召回|送回|托管/);
});
