export function statusMessageForActionResult(result: unknown, successMessage: string) {
  return isCanceledResult(result) ? "已取消。" : successMessage;
}

export function nextFriendEmailDraftAfterAddFriendAction(currentDraft: string, result: unknown) {
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
