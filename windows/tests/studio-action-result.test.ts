import assert from "node:assert/strict";
import test from "node:test";
import {
  nextFriendEmailDraftAfterAddFriendAction,
  nextFriendEmailDraftAfterSignOutAction,
  statusMessageForAddFriendAction,
  statusMessageForRemoveFriendAction,
  statusMessageForRefreshFriendsAction,
  statusMessageForHostingRequestAction,
  statusMessageForRecallAction,
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

test("clears friend email draft after a successful add-friend action", () => {
  assert.equal(nextFriendEmailDraftAfterAddFriendAction("friend@example.com", { friendAdded: true }), "");
  assert.equal(
    nextFriendEmailDraftAfterAddFriendAction("friend@example.com", { canceled: true }),
    "friend@example.com"
  );
});

test("uses Mac-parity copy for add-friend success", () => {
  assert.equal(
    statusMessageForAddFriendAction({ addedFriend: { name: "阿雯" } }),
    "已添加好友 阿雯。"
  );
});

test("uses Mac-parity copy for remove-friend success", () => {
  assert.equal(statusMessageForRemoveFriendAction("阿雯"), "已删除好友 阿雯。");
});

test("clears friend email draft after signing out", () => {
  assert.equal(nextFriendEmailDraftAfterSignOutAction("friend@example.com", undefined), "");
  assert.equal(
    nextFriendEmailDraftAfterSignOutAction("friend@example.com", { canceled: true }),
    "friend@example.com"
  );
});

test("uses Mac-parity copy for refreshed friend list results", () => {
  assert.equal(
    statusMessageForRefreshFriendsAction({ friendCards: [] }),
    "好友列表为空，可以用邮箱添加好友。"
  );
  assert.equal(
    statusMessageForRefreshFriendsAction({ friendCards: [{ id: "friend_1" }] }),
    "好友列表已刷新。"
  );
});

test("uses Mac-parity copy for desktop sync results", () => {
  assert.equal(
    statusMessageForSyncAction({ summary: { petCount: 2, materialCount: 9 } }),
    "已从网页同步 2 只宠物、9 个动作素材。"
  );
  assert.equal(statusMessageForSyncAction({ canceled: true }), "已取消同步，本地动作保持不变。");
});

test("uses Mac-parity copy for hosting request success", () => {
  assert.equal(
    statusMessageForHostingRequestAction("阿雯", "栗子"),
    "已向 阿雯 发起「栗子」寄养请求。"
  );
});

test("uses Mac-parity copy for recall success", () => {
  assert.equal(statusMessageForRecallAction("栗子"), "已召回「栗子」。");
});
