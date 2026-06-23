import assert from "node:assert/strict";
import test from "node:test";
import { refreshedFriendCardsAfterSync } from "../src/main/sync-policy.ts";
import type { DesktopFriendCard } from "../src/shared/desktop-sync-client.ts";

test("uses freshly fetched friend cards after a successful sync", async () => {
  const freshCards: DesktopFriendCard[] = [
    { id: "friend_fresh", name: "阿雯", status: "在线", hostedPets: 1 }
  ];

  assert.deepEqual(
    await refreshedFriendCardsAfterSync("desktop-token", [], async (accessToken) => {
      assert.equal(accessToken, "desktop-token");
      return freshCards;
    }),
    freshCards
  );
});

test("keeps existing friend cards when post-sync friend refresh fails", async () => {
  const existingCards: DesktopFriendCard[] = [
    { id: "friend_cached", name: "旧好友", status: "离线", hostedPets: 0 }
  ];

  assert.deepEqual(
    await refreshedFriendCardsAfterSync("desktop-token", existingCards, async () => {
      throw new Error("network down");
    }),
    existingCards
  );
});
