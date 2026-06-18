import test from "node:test";
import assert from "node:assert/strict";
import { canDeletePetForAccount } from "./pet-permissions.ts";
import type { CurrentUser, Pet } from "./types.ts";

const account: CurrentUser = {
  id: "user_demo",
  name: "栗子主人",
  email: "demo@desktop.pet",
  credits: 10120
};

function makePet(patch: Partial<Pet>): Pet {
  return {
    id: "pet_orange",
    petNumber: "CAT-20260616-0001",
    ownerUserId: "user_demo",
    currentHostUserId: "user_demo",
    name: "栗子",
    type: "cat",
    status: "在我的桌面",
    materialsReady: 0,
    mood: "好奇",
    host: "me",
    ownership: "owned",
    locationStatus: "at_owner_desktop",
    sourceImageUrl: null,
    frontImageUrl: null,
    ...patch
  };
}

test("owned account pets can be deleted even when hosted away", () => {
  const recalledOrAwayPet = makePet({
    id: "pet_white",
    ownerUserId: "user_demo",
    currentHostUserId: "friend_1",
    ownership: "away",
    host: "friend",
    locationStatus: "hosted_by_friend"
  });

  assert.equal(canDeletePetForAccount(account, recalledOrAwayPet), true);
});

test("friend-hosted pets visible on this account cannot be deleted", () => {
  const hostedPet = makePet({
    id: "pet_hosted",
    ownerUserId: "friend_1",
    currentHostUserId: "user_demo",
    ownership: "hosted",
    host: "me"
  });

  assert.equal(canDeletePetForAccount(account, hostedPet), false);
});
