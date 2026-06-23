import type { DesktopFriendCard } from "../shared/desktop-sync-client.ts";

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
