export function statusMessageForActionResult(result: unknown, successMessage: string) {
  return isCanceledResult(result) ? "已取消。" : successMessage;
}

export function statusMessageForRefreshFriendsAction(result: unknown) {
  return friendCardsFromActionResult(result).length === 0
    ? "好友列表为空，可以用邮箱添加好友。"
    : "好友列表已刷新。";
}

export function statusMessageForSyncAction(result: unknown) {
  if (isCanceledResult(result)) {
    return "已取消同步，本地动作保持不变。";
  }

  const summary = syncSummaryFromActionResult(result);
  if (!summary) {
    return "已同步网页端素材。";
  }

  return `已从网页同步 ${summary.petCount} 只宠物、${summary.materialCount} 个动作素材。`;
}

export function statusMessageForSignInAction() {
  return "登录成功。点击同步获取账号下的猫咪。";
}

export function statusMessageForSignOutAction() {
  return "已退出账号。本地已同步的猫咪资料和视频素材已保留。";
}

export function statusMessageForAddFriendAction(result: unknown) {
  const friendName = addedFriendNameFromActionResult(result);
  return friendName ? `已添加好友 ${friendName}。` : "已添加好友。";
}

export function statusMessageForAddFriendError() {
  return "添加失败，请确认账号邮箱。";
}

export function statusMessageForRemoveFriendAction(friendName: string) {
  return `已删除好友 ${friendName}。`;
}

export function statusMessageForHostingRequestAction(friendName: string, petName: string) {
  return `已向 ${friendName} 发起「${petName}」寄养请求。`;
}

export function statusMessageForRecallAction(petName: string) {
  return `已召回「${petName}」。`;
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

function syncSummaryFromActionResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const summary = (result as Record<string, unknown>).summary;
  if (!summary || typeof summary !== "object") {
    return undefined;
  }

  const record = summary as Record<string, unknown>;
  return typeof record.petCount === "number" && typeof record.materialCount === "number"
    ? { petCount: record.petCount, materialCount: record.materialCount }
    : undefined;
}

function addedFriendNameFromActionResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const addedFriend = (result as Record<string, unknown>).addedFriend;
  if (!addedFriend || typeof addedFriend !== "object") {
    return undefined;
  }

  const name = (addedFriend as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name : undefined;
}
