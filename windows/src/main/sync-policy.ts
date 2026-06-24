import type { DesktopFriendCard } from "../shared/desktop-sync-client.ts";

export function replacementWarningDialogOptions(replacements: string[]) {
  const preview = replacements.slice(0, 6).join("\n");
  const extraCount = Math.max(0, replacements.length - 6);
  const extraText = extraCount > 0 ? `\n还有 ${extraCount} 个动作也会被替换。` : "";

  return {
    type: "warning" as const,
    buttons: ["继续同步", "先不覆盖"],
    defaultId: 0,
    cancelId: 1,
    title: "同步会替换本地动作",
    message: "同步会替换本地动作",
    detail: `${preview}${extraText}\n\n继续同步后，这些位置会使用网页端最新素材。`
  };
}

export async function refreshedFriendCardsAfterSync(
  accessToken: string,
  existingFriendCards: DesktopFriendCard[],
  fetchFriends: (accessToken: string) => Promise<DesktopFriendCard[]>
) {
  try {
    return await fetchFriends(accessToken);
  } catch {
    return existingFriendCards;
  }
}
