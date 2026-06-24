import assert from "node:assert/strict";
import test from "node:test";
import {
  accountDetail,
  accountDisplayName,
  canRequestHosting,
  friendPanelDetail,
  friendPanelEmptyDetail,
  friendPanelEmptyTitle,
  friendPanelTitle,
  friendHostingDetail,
  loginPanelDetail,
  loginPanelTitle,
  localMaterialPreviewAction,
  localMaterialStatusText,
  localMaterialBoardDetail,
  localMaterialBoardTitle,
  resolveFriendRemovalTarget,
  resolveHostingRequestTarget,
  resolveRecallPetTarget,
  shouldShowRecallAction,
  syncedPetCardAction,
  syncedPetPanelDetail,
  syncedPetPanelEmptyDetail,
  syncedPetPanelEmptyTitle,
  syncedPetPanelTitle,
  statusTextForSyncedPet,
  syncedPetCardsAfterHostingRequest
} from "../src/shared/studio-model.ts";

test("builds account display copy", () => {
  assert.equal(accountDisplayName(undefined), "未登录");
  assert.equal(accountDetail(undefined), "登录后可同步网页端账号下的宠物数据。");
  assert.equal(
    accountDisplayName({
      id: "u1",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 120,
      accessToken: "token",
      signedInAt: "now"
    }),
    "栗子主人"
  );
  assert.equal(
    accountDetail({
      id: "u1",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 120,
      accessToken: "token",
      signedInAt: "now"
    }),
    "demo@desktop.pet · 120 积分"
  );
});

test("builds Mac-parity login panel copy for Windows", () => {
  assert.equal(loginPanelTitle(), "登录后同步你的猫咪");
  assert.equal(
    loginPanelDetail(),
    "Windows 端只负责显示、同步、好友寄养和召回；素材生成放在网页端。"
  );
});

test("builds Mac-parity friend hosting detail copy", () => {
  assert.equal(friendHostingDetail({ status: "在线", hostedPets: 2 }), "在线 · 托管 2 只");
});

test("builds Mac-parity friend panel copy", () => {
  assert.equal(friendPanelTitle(), "好友");
  assert.equal(friendPanelDetail(3), "3 位 · 可寄养和删除");
  assert.equal(friendPanelEmptyTitle(), "还没有好友");
  assert.equal(friendPanelEmptyDetail(), "用账号邮箱精确添加。在线状态先按服务器记录显示。");
});

test("builds Mac-parity local material status copy", () => {
  assert.equal(localMaterialStatusText({ hasVideo: true }), "已有视频");
  assert.equal(localMaterialStatusText({ hasVideo: false }), "未生成");
});

test("builds Mac-parity local material preview action state", () => {
  assert.deepEqual(localMaterialPreviewAction({ hasVideo: false, isPreviewing: false }), {
    label: "预览",
    disabled: true
  });
  assert.deepEqual(localMaterialPreviewAction({ hasVideo: true, isPreviewing: false }), {
    label: "预览",
    disabled: false
  });
  assert.deepEqual(localMaterialPreviewAction({ hasVideo: true, isPreviewing: true }), {
    label: "停止",
    disabled: false
  });
});

test("builds Mac-parity local material board copy", () => {
  assert.equal(localMaterialBoardTitle(), "动作卡册");
  assert.equal(localMaterialBoardDetail(), "有素材的动作会在对应场景出现；点预览看看效果。");
});

test("builds Mac-parity synced pet panel copy", () => {
  assert.equal(syncedPetPanelTitle(), "我的猫咪");
  assert.equal(syncedPetPanelDetail(4), "4 只");
  assert.equal(syncedPetPanelEmptyTitle(), "还没有同步猫咪");
  assert.equal(syncedPetPanelEmptyDetail(), "点右上角同步，从网页端拉取账号下的猫咪和素材。");
});

test("computes pet status and available actions", () => {
  assert.equal(statusTextForSyncedPet({ ownership: "owned", displayState: "active" }), "在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "hosted", displayState: "active" }), "寄养在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "away", displayState: "unavailable" }), "托管在朋友那里");
  assert.equal(statusTextForSyncedPet({ ownership: "away", displayState: "active" }), "托管在朋友那里");
  assert.equal(canRequestHosting({ ownership: "owned", displayState: "active" }), true);
  assert.equal(canRequestHosting({ ownership: "hosted", displayState: "active" }), false);
  assert.equal(shouldShowRecallAction({ ownership: "away", displayState: "unavailable" }, true), true);
  assert.equal(shouldShowRecallAction({ ownership: "away", displayState: "unavailable" }, false), false);
});

test("builds Mac-parity per-card synced pet actions", () => {
  assert.deepEqual(
    syncedPetCardAction({ ownership: "owned", displayState: "active" }, false),
    { type: "select", label: "选择" }
  );
  assert.equal(
    syncedPetCardAction({ ownership: "owned", displayState: "active" }, true),
    undefined
  );
  assert.deepEqual(
    syncedPetCardAction({ ownership: "away", displayState: "unavailable" }, true),
    { type: "recall", label: "召回" }
  );
  assert.deepEqual(
    syncedPetCardAction({ ownership: "away", displayState: "unavailable" }, false),
    { type: "select", label: "选择" }
  );
});

test("validates hosting requests like the Mac studio action entry", () => {
  const syncedPetCards = [
    { id: "pet_owned", ownership: "owned", displayState: "active" },
    { id: "pet_hosted", ownership: "hosted", displayState: "active" }
  ];
  const friendCards = [{ id: "friend_1" }];

  assert.deepEqual(
    resolveHostingRequestTarget("pet_owned", "friend_1", syncedPetCards, friendCards),
    { petId: "pet_owned", toUserId: "friend_1" }
  );

  assert.throws(
    () => resolveHostingRequestTarget("", "friend_1", syncedPetCards, friendCards),
    /请先同步并选择一只猫咪。/
  );
  assert.throws(
    () => resolveHostingRequestTarget("pet_hosted", "friend_1", syncedPetCards, friendCards),
    /这只猫现在不在我的桌面，先召回再寄养。/
  );
  assert.throws(
    () => resolveHostingRequestTarget("pet_owned", "", syncedPetCards, friendCards),
    /请选择一位好友。/
  );
});

test("keeps synced pet cards unchanged after a pending hosting request", () => {
  const cards = [
    { id: "pet_owned", ownership: "owned", displayState: "active", name: "栗子" }
  ];

  assert.deepEqual(
    syncedPetCardsAfterHostingRequest(cards, {
      requestId: "request_1",
      status: "pending",
      petId: "pet_owned",
      toUserId: "friend_1"
    }),
    cards
  );
});

test("validates recall requests against synced pet cards", () => {
  const syncedPetCards = [
    { id: "pet_away", ownership: "away", displayState: "unavailable" },
    { id: "pet_owned", ownership: "owned", displayState: "active" }
  ];

  assert.deepEqual(resolveRecallPetTarget("pet_away", syncedPetCards), { petId: "pet_away" });
  assert.throws(
    () => resolveRecallPetTarget("pet_owned", syncedPetCards),
    /这只猫不需要召回。/
  );
  assert.throws(
    () => resolveRecallPetTarget("pet_missing", syncedPetCards),
    /请先同步并选择一只猫咪。/
  );
});

test("validates friend removal against known friend cards", () => {
  const friendCards = [{ id: "friend_1" }];

  assert.deepEqual(resolveFriendRemovalTarget("friend_1", friendCards), { friendId: "friend_1" });
  assert.throws(
    () => resolveFriendRemovalTarget("friend_missing", friendCards),
    /请选择一位好友。/
  );
});
