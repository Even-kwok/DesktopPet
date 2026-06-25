export function statusMessageForActionResult(result: unknown, successMessage: string) {
  return isCanceledResult(result) ? "已取消。" : successMessage;
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

export function pendingStatusMessageForSyncAction() {
  return "正在从网页同步生成好的素材...";
}

export function pendingStatusMessageForSignInAction() {
  return "正在登录账号...";
}

export function pendingStatusMessageForImportVideoAction(slotName: string) {
  return `正在检查「${slotName}」视频...`;
}

export function statusMessageForImportVideoAction(slotName: string, result: unknown) {
  if (isCanceledResult(result)) {
    return "已取消。";
  }

  const warningText = importVideoWarningMessagesFromActionResult(result).join(" ");
  return `已导入「${slotName}」本地视频。${warningText ? ` ${warningText}` : ""}`;
}

export function statusMessageForRemoveVideoAction(slotName: string) {
  return `已移除「${slotName}」本地视频。`;
}

export function statusMessageForSignInAction() {
  return "登录成功。点击同步获取账号下的猫咪。";
}

export function statusMessageForSignOutAction() {
  return "已退出账号。本地已同步的猫咪资料和视频素材已保留。";
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

function syncSummaryFromActionResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const summary = (result as Record<string, unknown>).summary;
  if (!summary || typeof summary !== "object") {
    return undefined;
  }

  const record = summary as Record<string, unknown>;
  return isSummaryCount(record.petCount) && isSummaryCount(record.materialCount)
    ? { petCount: record.petCount, materialCount: record.materialCount }
    : undefined;
}

function isSummaryCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function importVideoWarningMessagesFromActionResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return [];
  }

  const importResult = (result as Record<string, unknown>).result;
  if (!importResult || typeof importResult !== "object") {
    return [];
  }

  const warningMessages = (importResult as Record<string, unknown>).warningMessages;
  return Array.isArray(warningMessages)
    ? warningMessages.filter((message): message is string => typeof message === "string")
    : [];
}
