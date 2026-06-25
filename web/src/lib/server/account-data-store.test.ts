import test from "node:test";
import assert from "node:assert/strict";
import * as accountDataState from "../account-data-state.ts";
import {
  addFriendToState,
  adjustUserCreditsInState,
  createHostingRequestInState,
  createGenerationJobInState,
  createMockAccountDataState,
  createPetInState,
  deleteUserFromState,
  deletePetFromState,
  findActiveGenerationJobInState,
  desktopEventsForAccount,
  hostingRequestsForAccount,
  loadMockAccountDataSnapshot,
  normalizePetAssets,
  removeFriendFromState,
  updateHostingRequestInState,
  updateGenerationJobInState,
  updatePetImagesInState,
  updatePetNameInState,
  upsertPetAssetInState,
  updateUserProfileInState
} from "../account-data-state.ts";
import type { CurrentUser, Pet, PetAsset } from "../types.ts";

const account: CurrentUser = {
  id: "user_demo",
  name: "栗子主人",
  email: "demo@desktop.pet",
  credits: 10120
};

const friendAccount: CurrentUser = {
  id: "friend_1",
  name: "Mika",
  email: "mika@desktop.pet",
  credits: 0
};

const ownPet: Pet = {
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
  frontImageUrl: null
};

const hostedPet: Pet = {
  id: "pet_hosted",
  petNumber: "CAT-20260616-0002",
  ownerUserId: "friend_1",
  currentHostUserId: "user_demo",
  name: "奶盖",
  type: "cat",
  status: "寄养在我的桌面",
  materialsReady: 0,
  mood: "开心",
  host: "me",
  ownership: "hosted",
  locationStatus: "at_owner_desktop",
  sourceImageUrl: null,
  frontImageUrl: null
};

const otherPet: Pet = {
  id: "pet_other",
  petNumber: "CAT-20260616-0003",
  ownerUserId: "other_user",
  currentHostUserId: "other_user",
  name: "路过猫",
  type: "cat",
  status: "不属于当前账号",
  materialsReady: 0,
  mood: "安静",
  host: "me",
  ownership: "owned",
  locationStatus: "at_owner_desktop",
  sourceImageUrl: null,
  frontImageUrl: null
};

const starterPet = {
  ...ownPet,
  id: "pet_starter",
  petNumber: "CAT-20260616-0000",
  name: "体验猫",
  isReadonly: true
} as Pet & { isReadonly: true };

test("mock account snapshot only exposes owned or hosted pets", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet, hostedPet, otherPet],
    assets: [
      {
        petId: "pet_orange",
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/orange-idle.mp4"
      },
      {
        petId: "pet_hosted",
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/hosted-idle.mp4"
      },
      {
        petId: "pet_other",
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/other-idle.mp4"
      }
    ]
  });

  const snapshot = loadMockAccountDataSnapshot(account, state);

  assert.deepEqual(
    snapshot.pets.map((pet) => pet.id),
    ["pet_orange", "pet_hosted"]
  );
  assert.deepEqual(
    snapshot.assets.map((asset) => asset.petId),
    ["pet_orange", "pet_hosted"]
  );
});

test("updateUserProfileInState persists the display name in account snapshots", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: []
  });

  const updatedUser = updateUserProfileInState(state, account, {
    name: "  自定义主人  "
  });
  const snapshot = loadMockAccountDataSnapshot(account, state);

  assert.equal(updatedUser.name, "自定义主人");
  assert.equal(snapshot.user.name, "自定义主人");
  assert.throws(
    () => updateUserProfileInState(state, account, { name: "   " }),
    /DISPLAY_NAME_REQUIRED/
  );
});

test("adjustUserCreditsInState applies signed admin deltas and keeps balances nonnegative", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [],
    assets: []
  });

  const added = adjustUserCreditsInState(state, {
    userId: account.id,
    amount: 100,
    reason: "客服补偿"
  });
  const deducted = adjustUserCreditsInState(state, {
    userId: account.id,
    amount: -20000,
    reason: "异常扣回"
  });

  assert.equal(added.previousBalance, 10120);
  assert.equal(added.balance, 10220);
  assert.equal(added.amount, 100);
  assert.equal(added.reason, "客服补偿");
  assert.equal(deducted.previousBalance, 10220);
  assert.equal(deducted.balance, 0);
  assert.equal(state.users[0]?.credits, 0);
});

test("adjustUserCreditsInState validates user, amount, and reason", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [],
    assets: []
  });

  assert.throws(
    () => adjustUserCreditsInState(state, { userId: "missing", amount: 10, reason: "补偿" }),
    /USER_NOT_FOUND/
  );
  assert.throws(
    () => adjustUserCreditsInState(state, { userId: account.id, amount: 0, reason: "补偿" }),
    /CREDIT_ADJUSTMENT_AMOUNT_REQUIRED/
  );
  assert.throws(
    () => adjustUserCreditsInState(state, { userId: account.id, amount: 10, reason: "   " }),
    /CREDIT_ADJUSTMENT_REASON_REQUIRED/
  );
});

test("deletePetFromState cascades pet assets and protects other accounts", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet, hostedPet, otherPet],
    assets: [
      { petId: "pet_orange", slot: "idle_loop", status: "ready", videoUrl: "https://example.com/idle.mp4" },
      { petId: "pet_orange", slot: "sleep_loop", status: "ready", videoUrl: "https://example.com/sleep.mp4" },
      { petId: "pet_other", slot: "idle_loop", status: "ready", videoUrl: "https://example.com/other.mp4" }
    ]
  });

  const result = deletePetFromState(state, account, "pet_orange");

  assert.deepEqual(result, { deletedPetId: "pet_orange", deletedAssets: 2 });
  assert.deepEqual(
    state.pets.map((pet) => pet.id),
    ["pet_hosted", "pet_other"]
  );
  assert.deepEqual(
    state.assets.map((asset) => asset.petId),
    ["pet_other"]
  );

  assert.throws(() => deletePetFromState(state, account, "pet_other"), /PET_NOT_FOUND/);
});

test("deleteUserFromState removes the account and owned pets for admin testing", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [ownPet, hostedPet],
    assets: [
      {
        petId: ownPet.id,
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/idle.mp4"
      },
      {
        petId: hostedPet.id,
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/hosted.mp4"
      }
    ],
    generationJobs: [
      {
        jobId: "job_owned",
        type: "action_video",
        status: "succeeded",
        cost: 12,
        petId: ownPet.id,
        slot: "idle_loop",
        resultUrl: "https://example.com/idle.mp4"
      }
    ],
    referralCodes: [
      {
        id: "refcode_owned",
        code: "OWNED20",
        ownerUserId: account.id,
        status: "active",
        createdAt: "2026-06-23T00:00:00.000Z",
        updatedAt: "2026-06-23T00:00:00.000Z"
      }
    ],
    userReferrals: [
      {
        referredUserId: friendAccount.id,
        referralCodeId: "refcode_owned",
        referralCode: "OWNED20",
        referrerUserId: "00000000-0000-4000-8000-000000009999",
        registeredAt: "2026-06-23T00:00:00.000Z",
        rewardPercentAtRegistration: 10,
        firstRechargeDiscountPercentAtRegistration: 20
      }
    ],
    referralRewardLedger: [
      {
        id: "reward_owned_code",
        referrerUserId: "00000000-0000-4000-8000-000000009999",
        referredUserId: friendAccount.id,
        referralCodeId: "refcode_owned",
        referralCode: "OWNED20",
        rechargeRecordId: "recharge_friend_referral",
        amountCents: 990,
        currency: "CNY",
        rewardPercent: 10,
        rewardAmountCents: 99,
        rewardCredits: 10,
        status: "posted",
        createdAt: "2026-06-23T00:00:00.000Z"
      }
    ],
    rechargeRecords: [
      {
        id: "recharge_user",
        userId: account.id,
        provider: "manual",
        amountCents: 990,
        currency: "CNY",
        creditsGranted: 100,
        status: "paid",
        discountPercent: 0,
        discountAmountCents: 0,
        createdAt: "2026-06-23T00:00:00.000Z",
        updatedAt: "2026-06-23T00:00:00.000Z"
      },
      {
        id: "recharge_friend_referral",
        userId: friendAccount.id,
        provider: "manual",
        amountCents: 990,
        currency: "CNY",
        creditsGranted: 100,
        status: "paid",
        discountPercent: 20,
        discountAmountCents: 198,
        referralCodeId: "refcode_owned",
        referredByUserId: "00000000-0000-4000-8000-000000009999",
        createdAt: "2026-06-23T00:00:00.000Z",
        updatedAt: "2026-06-23T00:00:00.000Z"
      }
    ]
  });

  const result = deleteUserFromState(state, account.id);

  assert.deepEqual(result, {
    deletedUserId: account.id,
    deletedPets: 1,
    deletedAssets: 1
  });
  assert.deepEqual(state.users.map((user) => user.id), [friendAccount.id]);
  assert.deepEqual(state.pets.map((pet) => pet.id), [hostedPet.id]);
  assert.deepEqual(state.assets.map((asset) => asset.petId), [hostedPet.id]);
  assert.deepEqual(state.generationJobs, []);
  assert.deepEqual(state.referralCodes, []);
  assert.deepEqual(state.userReferrals, []);
  assert.deepEqual(state.referralRewardLedger, []);
  assert.deepEqual(state.rechargeRecords, []);
});

test("readonly starter pets sort after user-added pets in account snapshots", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [starterPet, ownPet],
    assets: []
  });

  const snapshot = loadMockAccountDataSnapshot(account, state);

  assert.deepEqual(
    snapshot.pets.map((pet) => pet.id),
    ["pet_orange", "pet_starter"]
  );
});

test("readonly starter pets can be deleted by their owner", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [starterPet],
    assets: [
      {
        petId: starterPet.id,
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/starter-idle.mp4"
      }
    ]
  });

  assert.deepEqual(deletePetFromState(state, account, starterPet.id), {
    deletedPetId: starterPet.id,
    deletedAssets: 1
  });
  assert.deepEqual(state.pets, []);
});

test("readonly starter pets cannot be renamed, reimaged, or regenerated", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [starterPet],
    assets: []
  });

  assert.throws(
    () => updatePetNameInState(state, account, { petId: starterPet.id, name: "新名字" }),
    /PET_READONLY/
  );
  assert.throws(
    () => updatePetImagesInState(state, account, {
      petId: starterPet.id,
      imageUrl: "https://example.com/new.png"
    }),
    /PET_READONLY/
  );
  assert.throws(
    () =>
      upsertPetAssetInState(state, account, {
        petId: starterPet.id,
        slot: "idle_loop",
        videoUrl: "https://example.com/new-idle.mp4"
      }),
    /PET_READONLY/
  );
  assert.throws(
    () =>
      createGenerationJobInState(state, account, {
        jobId: "jimeng_starter",
        type: "action_video",
        status: "queued",
        cost: 18,
        petId: starterPet.id,
        slot: "idle_loop",
        resultUrl: null
      }),
    /PET_READONLY/
  );
});

test("updatePetNameInState persists owned pet names in account snapshots", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet, hostedPet, otherPet],
    assets: []
  });

  const updatedPet = updatePetNameInState(state, account, {
    petId: ownPet.id,
    name: "  豆沙  "
  });
  const snapshot = loadMockAccountDataSnapshot(account, state);

  assert.equal(updatedPet.name, "豆沙");
  assert.equal(snapshot.pets.find((pet) => pet.id === ownPet.id)?.name, "豆沙");
  assert.throws(
    () => updatePetNameInState(state, account, { petId: ownPet.id, name: "   " }),
    /PET_NAME_REQUIRED/
  );
  assert.throws(
    () => updatePetNameInState(state, account, { petId: hostedPet.id, name: "不能改" }),
    /PET_NOT_FOUND/
  );
});

test("createPetInState adds an owned desktop pet with the next account name and pet number", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: []
  });

  const pet = createPetInState(state, account, {
    id: "pet_new",
    now: new Date("2026-06-17T00:00:00.000Z")
  });

  assert.equal(pet.id, "pet_new");
  assert.equal(pet.petNumber, "CAT-20260617-0001");
  assert.equal(pet.name, "猫咪 2");
  assert.equal(pet.ownerUserId, account.id);
  assert.equal(pet.currentHostUserId, account.id);
  assert.equal(pet.status, "在我的桌面");
  assert.equal(state.pets.at(-1)?.id, "pet_new");
});

test("createPetInState inserts new pets before readonly starter pets", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [starterPet],
    assets: []
  });

  const pet = createPetInState(state, account, {
    id: "pet_new",
    now: new Date("2026-06-17T00:00:00.000Z")
  });

  assert.equal(pet.name, "猫咪 1");
  assert.deepEqual(
    state.pets.map((item) => item.id),
    ["pet_new", "pet_starter"]
  );
});

test("addFriendToState adds a friend by email and counts pets hosted by that friend", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [
      ownPet,
      {
        ...ownPet,
        id: "pet_hosted_by_friend",
        petNumber: "CAT-20260617-0002",
        currentHostUserId: friendAccount.id
      }
    ],
    assets: [],
    friends: []
  });

  const friend = addFriendToState(state, account, " MIKA@desktop.pet ");

  assert.deepEqual(friend, {
    id: friendAccount.id,
    name: "Mika",
    status: "离线",
    hostedPets: 1
  });
  assert.equal(state.friends.length, 1);
  assert.equal(addFriendToState(state, account, "mika@desktop.pet").id, friendAccount.id);
  assert.equal(state.friends.length, 1);
});

test("removeFriendFromState deletes the friend relation", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [],
    assets: [],
    friends: [{ id: friendAccount.id, name: "Mika", status: "离线", hostedPets: 0 }]
  });

  assert.deepEqual(removeFriendFromState(state, friendAccount.id), {
    deletedFriendId: friendAccount.id
  });
  assert.deepEqual(state.friends, []);
  assert.throws(() => removeFriendFromState(state, friendAccount.id), /FRIEND_NOT_FOUND/);
});

test("hosting requests are visible to the sender and receiver with viewer-specific copy", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [ownPet],
    assets: [],
    friends: [{ id: friendAccount.id, name: friendAccount.name, status: "离线", hostedPets: 0 }]
  });

  const request = createHostingRequestInState(state, account, {
    id: "hosting_1",
    petId: ownPet.id,
    toUserId: friendAccount.id
  });

  assert.equal(request.id, "hosting_1");
  assert.equal(request.statusCode, "pending");
  assert.deepEqual(
    hostingRequestsForAccount(state, account).map((item) => [
      item.id,
      item.petName,
      item.from,
      item.status,
      item.petId,
      item.fromUserId,
      item.toUserId,
      item.statusCode
    ]),
    [["hosting_1", "栗子", "你", "等待 Mika 接收", ownPet.id, account.id, friendAccount.id, "pending"]]
  );
  assert.deepEqual(
    loadMockAccountDataSnapshot(friendAccount, state).hostingRequests.map((item) => [
      item.id,
      item.petName,
      item.from,
      item.status,
      item.petId,
      item.fromUserId,
      item.toUserId,
      item.statusCode
    ]),
    [["hosting_1", "栗子", "栗子主人", "等待你接收", ownPet.id, account.id, friendAccount.id, "pending"]]
  );
  assert.deepEqual(
    desktopEventsForAccount(state, friendAccount).map((event) => [
      event.type,
      event.userId,
      event.actorUserId,
      event.petId,
      event.hostingRequestId
    ]),
    [["hosting_request_created", friendAccount.id, account.id, ownPet.id, "hosting_1"]]
  );
});

test("accepting a hosting request moves the pet to the receiver desktop", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [ownPet],
    assets: [],
    friends: [{ id: friendAccount.id, name: friendAccount.name, status: "离线", hostedPets: 0 }]
  });
  createHostingRequestInState(state, account, {
    id: "hosting_1",
    petId: ownPet.id,
    toUserId: friendAccount.id
  });

  const updatedRequest = updateHostingRequestInState(state, friendAccount, {
    requestId: "hosting_1",
    action: "accept"
  });

  assert.equal(updatedRequest.statusCode, "accepted");
  assert.equal(updatedRequest.status, "已接收托管");
  assert.equal(state.pets[0]?.currentHostUserId, friendAccount.id);
  assert.equal(state.pets[0]?.locationStatus, "hosted_by_friend");
  assert.equal(loadMockAccountDataSnapshot(friendAccount, state).pets[0]?.ownership, "hosted");
  assert.equal(loadMockAccountDataSnapshot(friendAccount, state).pets[0]?.status, "寄养在我的桌面");
  assert.equal(loadMockAccountDataSnapshot(account, state).pets[0]?.ownership, "away");
  assert.equal(loadMockAccountDataSnapshot(account, state).pets[0]?.status, "托管在朋友家");
  assert.deepEqual(hostingRequestsForAccount(state, account), []);
  assert.deepEqual(hostingRequestsForAccount(state, friendAccount), []);
  assert.deepEqual(
    desktopEventsForAccount(state, account).map((event) => [
      event.type,
      event.userId,
      event.actorUserId,
      event.petId,
      event.hostingRequestId
    ]),
    [["hosting_request_accepted", account.id, friendAccount.id, ownPet.id, "hosting_1"]]
  );
  assert.deepEqual(
    desktopEventsForAccount(state, friendAccount).map((event) => [
      event.type,
      event.userId,
      event.actorUserId,
      event.petId,
      event.hostingRequestId
    ]),
    [
      ["hosting_request_created", friendAccount.id, account.id, ownPet.id, "hosting_1"],
      ["desktop_bundle_changed", friendAccount.id, friendAccount.id, ownPet.id, "hosting_1"]
    ]
  );
});

test("declining a hosting request reports rejection without moving the pet", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [ownPet],
    assets: [],
    friends: [{ id: friendAccount.id, name: friendAccount.name, status: "离线", hostedPets: 0 }]
  });
  createHostingRequestInState(state, account, {
    id: "hosting_1",
    petId: ownPet.id,
    toUserId: friendAccount.id
  });

  const updatedRequest = updateHostingRequestInState(state, friendAccount, {
    requestId: "hosting_1",
    action: "decline"
  });

  assert.equal(updatedRequest.statusCode, "declined");
  assert.equal(updatedRequest.status, "已拒绝");
  assert.equal(state.pets[0]?.currentHostUserId, account.id);
  assert.deepEqual(loadMockAccountDataSnapshot(friendAccount, state).pets, []);
  assert.deepEqual(hostingRequestsForAccount(state, account), []);
  assert.deepEqual(hostingRequestsForAccount(state, friendAccount), []);
  assert.deepEqual(
    desktopEventsForAccount(state, account).map((event) => [
      event.type,
      event.userId,
      event.actorUserId,
      event.petId,
      event.hostingRequestId
    ]),
    [["hosting_request_declined", account.id, friendAccount.id, ownPet.id, "hosting_1"]]
  );
});

test("returning an accepted hosting request sends recall events to owner and receiver", () => {
  const state = createMockAccountDataState({
    users: [account, friendAccount],
    pets: [ownPet],
    assets: [],
    friends: [{ id: friendAccount.id, name: friendAccount.name, status: "离线", hostedPets: 0 }]
  });
  createHostingRequestInState(state, account, {
    id: "hosting_1",
    petId: ownPet.id,
    toUserId: friendAccount.id
  });
  updateHostingRequestInState(state, friendAccount, {
    requestId: "hosting_1",
    action: "accept"
  });

  const returnedRequest = updateHostingRequestInState(state, friendAccount, {
    requestId: "hosting_1",
    action: "return"
  });

  assert.equal(returnedRequest.statusCode, "returned");
  assert.equal(state.pets[0]?.currentHostUserId, account.id);
  assert.deepEqual(hostingRequestsForAccount(state, account), []);
  assert.deepEqual(hostingRequestsForAccount(state, friendAccount), []);
  assert.deepEqual(
    desktopEventsForAccount(state, account).map((event) => event.type),
    ["hosting_request_accepted", "pet_recalled"]
  );
  assert.deepEqual(
    desktopEventsForAccount(state, friendAccount).map((event) => event.type),
    ["hosting_request_created", "desktop_bundle_changed", "pet_recalled"]
  );
});

test("normalizePetAssets only marks ready assets that have a real video URL", () => {
  const assets: PetAsset[] = normalizePetAssets([
    { petId: "pet_orange", slot: "idle_loop", status: "ready", videoUrl: "https://example.com/idle.mp4" },
    { petId: "pet_orange", slot: "sleep_loop", status: "ready", videoUrl: null },
    { petId: "pet_orange", slot: "click_react", status: "generating", videoUrl: null }
  ]);

  assert.deepEqual(
    assets.map((asset) => [asset.slot, asset.status]),
    [
      ["idle_loop", "ready"],
      ["sleep_loop", "missing"],
      ["click_react", "generating"]
    ]
  );
});

test("updating a pet source image preserves ready assets and retires active jobs", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet, otherPet],
    assets: [
      { petId: ownPet.id, slot: "idle_loop", status: "ready", videoUrl: "https://example.com/old-idle.mp4" },
      { petId: ownPet.id, slot: "sleep_loop", status: "ready", videoUrl: "https://example.com/old-sleep.mp4" },
      { petId: otherPet.id, slot: "idle_loop", status: "ready", videoUrl: "https://example.com/other-idle.mp4" }
    ],
    generationJobs: [
      {
        jobId: "jimeng_running",
        type: "action_video",
        status: "running",
        cost: 18,
        petId: ownPet.id,
        slot: "idle_loop",
        resultUrl: null
      },
      {
        jobId: "jimeng_done",
        type: "action_video",
        status: "succeeded",
        cost: 14,
        petId: ownPet.id,
        slot: "sleep_loop",
        resultUrl: "https://example.com/old-sleep.mp4"
      }
    ]
  });

  const updatedPet = updatePetImagesInState(state, account, {
    petId: ownPet.id,
    imageUrl: "https://example.com/new-source.png"
  });

  assert.equal(updatedPet.frontImageUrl, "https://example.com/new-source.png");
  assert.deepEqual(state.assets, [
    { petId: ownPet.id, slot: "idle_loop", status: "ready", videoUrl: "https://example.com/old-idle.mp4" },
    { petId: ownPet.id, slot: "sleep_loop", status: "ready", videoUrl: "https://example.com/old-sleep.mp4" },
    { petId: otherPet.id, slot: "idle_loop", status: "ready", videoUrl: "https://example.com/other-idle.mp4" }
  ]);
  assert.equal(state.generationJobs[0]?.status, "expired");
  assert.equal(state.generationJobs[1]?.status, "succeeded");
  assert.equal(
    findActiveGenerationJobInState(state, account, {
      petId: ownPet.id,
      slot: "idle_loop",
      type: "action_video"
    }),
    null
  );

  const newJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_new_source",
    type: "action_video",
    status: "queued",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    resultUrl: null,
    sourceImageUrl: "https://example.com/new-source.png"
  });

  assert.equal(newJob.jobId, "jimeng_new_source");
});

test("active generation jobs are reused for the same pet slot", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: []
  });
  const firstJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_first",
    type: "action_video",
    status: "queued",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 0,
    resultUrl: null,
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  const secondJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_second",
    type: "action_video",
    status: "queued",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 0,
    resultUrl: null,
    createdAt: "2026-06-17T00:00:01.000Z"
  });

  assert.equal(secondJob.jobId, firstJob.jobId);
  assert.equal(state.generationJobs.length, 1);
  assert.equal(state.users[0]?.credits, 10102);
  assert.deepEqual(state.assets, [
    {
      petId: ownPet.id,
      slot: "idle_loop",
      status: "generating",
      videoUrl: null
    }
  ]);
});

test("stale active generation jobs expire and release the material slot", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: []
  });
  const runningJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_stale",
    type: "action_video",
    status: "queued",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 0,
    resultUrl: null,
    createdAt: "2026-06-18T01:00:00.000Z"
  });

  assert.equal(typeof accountDataState.expireStaleGenerationJobsInState, "function");

  const expiredJobs = accountDataState.expireStaleGenerationJobsInState(state, account, {
    now: new Date("2026-06-18T01:16:00.000Z"),
    timeoutMs: 15 * 60 * 1000
  });

  assert.deepEqual(expiredJobs.map((job) => job.jobId), [runningJob.jobId]);
  assert.equal(state.generationJobs[0]?.status, "expired");
  assert.equal(state.generationJobs[0]?.progress, 100);
  assert.match(state.generationJobs[0]?.message ?? "", /停下/);
  assert.equal(state.users[0]?.credits, account.credits);
  assert.deepEqual(state.assets, [
    {
      petId: ownPet.id,
      slot: "idle_loop",
      status: "failed",
      videoUrl: null
    }
  ]);
  assert.equal(
    findActiveGenerationJobInState(state, account, {
      petId: ownPet.id,
      slot: "idle_loop",
      type: "action_video"
    }),
    null
  );
});

test("default provider generation timeout allows longer paid video jobs", () => {
  assert.equal(accountDataState.defaultGenerationJobTimeoutMs, 30 * 60 * 1000);
});

test("default provider generation timeout does not expire ten-minute video jobs", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: []
  });
  createGenerationJobInState(state, account, {
    jobId: "jimeng_recent",
    type: "action_video",
    status: "running",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 94,
    resultUrl: null,
    createdAt: "2026-06-18T01:00:00.000Z"
  });

  const expiredJobs = accountDataState.expireStaleGenerationJobsInState(state, account, {
    now: new Date("2026-06-18T01:11:00.000Z")
  });

  assert.deepEqual(expiredJobs, []);
  assert.equal(state.generationJobs[0]?.status, "running");
  assert.equal(state.users[0]?.credits, account.credits - 18);
});

test("late provider success can recover an expired material without another debit", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: [
      {
        petId: ownPet.id,
        slot: "idle_loop",
        status: "failed",
        videoUrl: null
      }
    ]
  });
  const expiredJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_late_success",
    type: "action_video",
    status: "running",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 94,
    resultUrl: null,
    createdAt: "2026-06-18T01:00:00.000Z"
  });

  updateGenerationJobInState(state, account, {
    ...expiredJob,
    status: "expired",
    message: "Timed out"
  });
  const refundedCredits = state.users[0]?.credits;

  updateGenerationJobInState(state, account, {
    ...expiredJob,
    status: "succeeded",
    progress: 100,
    resultUrl: "https://example.com/recovered.mp4",
    message: "Recovered after timeout"
  });

  assert.equal(state.generationJobs[0]?.status, "succeeded");
  assert.equal(state.assets[0]?.status, "ready");
  assert.equal(state.assets[0]?.videoUrl, "https://example.com/recovered.mp4");
  assert.equal(state.users[0]?.credits, refundedCredits);
});

test("failed active generation jobs refund the debited credits once", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: []
  });
  const runningJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_failed",
    type: "action_video",
    status: "queued",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 0,
    resultUrl: null,
    createdAt: "2026-06-18T01:00:00.000Z"
  });

  assert.equal(state.users[0]?.credits, account.credits - 18);

  updateGenerationJobInState(state, account, {
    ...runningJob,
    status: "failed",
    message: "Provider failed"
  });
  updateGenerationJobInState(state, account, {
    ...runningJob,
    status: "failed",
    message: "Provider failed again"
  });

  assert.equal(state.users[0]?.credits, account.credits);
});

test("failed regeneration preserves the previously ready material", () => {
  const state = createMockAccountDataState({
    users: [account],
    pets: [ownPet],
    assets: [
      {
        petId: ownPet.id,
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/old-idle.mp4"
      }
    ]
  });

  const runningJob = createGenerationJobInState(state, account, {
    jobId: "jimeng_retry",
    type: "action_video",
    status: "queued",
    cost: 18,
    petId: ownPet.id,
    slot: "idle_loop",
    progress: 0,
    resultUrl: null,
    createdAt: "2026-06-17T00:00:00.000Z"
  });

  assert.equal(state.assets[0]?.videoUrl, "https://example.com/old-idle.mp4");
  assert.equal(state.assets[0]?.status, "ready");

  updateGenerationJobInState(state, account, {
    ...runningJob,
    status: "failed",
    message: "参考图不符合要求"
  });

  assert.deepEqual(state.assets, [
    {
      petId: ownPet.id,
      slot: "idle_loop",
      status: "ready",
      videoUrl: "https://example.com/old-idle.mp4"
    }
  ]);
});
