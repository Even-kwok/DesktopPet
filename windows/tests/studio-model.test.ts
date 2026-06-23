import assert from "node:assert/strict";
import test from "node:test";
import {
  accountDetail,
  canRequestHosting,
  resolveHostingRequestTarget,
  shouldShowRecallAction,
  statusTextForSyncedPet
} from "../src/shared/studio-model.ts";

test("builds account display copy", () => {
  assert.equal(accountDetail(undefined), "登录后可同步网页端账号下的宠物数据。");
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

test("computes pet status and available actions", () => {
  assert.equal(statusTextForSyncedPet({ ownership: "owned", displayState: "active" }), "在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "hosted", displayState: "active" }), "寄养在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "away", displayState: "unavailable" }), "托管在朋友那里");
  assert.equal(canRequestHosting({ ownership: "owned", displayState: "active" }), true);
  assert.equal(canRequestHosting({ ownership: "hosted", displayState: "active" }), false);
  assert.equal(shouldShowRecallAction({ ownership: "away", displayState: "unavailable" }, true), true);
  assert.equal(shouldShowRecallAction({ ownership: "away", displayState: "unavailable" }, false), false);
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
