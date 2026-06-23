export function statusMessageForActionResult(result: unknown, successMessage: string) {
  return isCanceledResult(result) ? "已取消。" : successMessage;
}

export function statusMessageForRefreshFriendsAction(result: unknown) {
  return friendCardsFromActionResult(result).length === 0
    ? "好友列表为空，可以用邮箱添加好友。"
    : "好友列表已刷新。";
}

export function nextFriendEmailDraftAfterAddFriendAction(currentDraft: string, result: unknown) {
  return nextFriendEmailDraftAfterSuccessfulAction(currentDraft, result);
}

export function nextFriendEmailDraftAfterSignOutAction(currentDraft: string, result: unknown) {
  return nextFriendEmailDraftAfterSuccessfulAction(currentDraft, result);
}

function nextFriendEmailDraftAfterSuccessfulAction(currentDraft: string, result: unknown) {
  return isCanceledResult(result) ? currentDraft : "";
}

function isCanceledResult(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }

  const record = result as Record<string, unknown>;
  if (record.canceled === true) {
    return true;
  }

  return isCanceledResult(record.result);
}

function friendCardsFromActionResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return [];
  }

  const friendCards = (result as Record<string, unknown>).friendCards;
  return Array.isArray(friendCards) ? friendCards : [];
}
