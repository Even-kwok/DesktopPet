import test from "node:test";
import assert from "node:assert/strict";
import { buildDesktopPetBundle } from "./desktop-bundle.ts";

test("desktop bundle exports only ready materials with video URLs", () => {
  const bundle = buildDesktopPetBundle({
    generatedAt: "2026-06-16T08:00:00.000Z",
    account: {
      id: "user_demo",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 10120
    },
    pets: [
      {
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
        sourceImageUrl: "https://example.com/source.png",
        frontImageUrl: "https://example.com/front.png"
      }
    ],
    assets: [
      {
        petId: "pet_orange",
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/idle.mp4"
      },
      {
        petId: "pet_orange",
        slot: "drag_loop",
        status: "ready",
        videoUrl: "https://example.com/drag.mp4"
      },
      {
        petId: "pet_orange",
        slot: "sleep_loop",
        status: "ready",
        videoUrl: null
      },
      {
        petId: "pet_orange",
        slot: "click_react",
        status: "generating",
        videoUrl: "https://example.com/click.mp4"
      }
    ]
  });

  assert.equal(bundle.generatedAt, "2026-06-16T08:00:00.000Z");
  assert.equal(bundle.account?.id, "user_demo");
  assert.equal(bundle.account?.credits, 10120);
  assert.equal(bundle.pets.length, 1);
  assert.equal(bundle.pets[0].name, "栗子");
  assert.equal(bundle.pets[0].petNumber, "CAT-20260616-0001");
  assert.equal(bundle.pets[0].ownerUserId, "user_demo");
  assert.equal(bundle.pets[0].currentHostUserId, "user_demo");
  assert.equal(bundle.pets[0].ownership, "owned");
  assert.equal(bundle.pets[0].displayState, "active");
  assert.equal(bundle.pets[0].avatarUrl, "https://example.com/front.png");
  assert.deepEqual(
    bundle.pets[0].materials.map((material) => material.slot),
    ["idle_loop"]
  );
});

test("desktop bundle marks pets hosted away as unavailable for the owner desktop", () => {
  const bundle = buildDesktopPetBundle({
    generatedAt: "2026-06-16T08:00:00.000Z",
    pets: [
      {
        id: "pet_white",
        petNumber: "CAT-20260616-0002",
        ownerUserId: "user_demo",
        currentHostUserId: "friend_1",
        name: "雪球",
        type: "cat",
        status: "托管在朋友家",
        materialsReady: 1,
        mood: "犯困",
        host: "friend",
        ownership: "away",
        locationStatus: "hosted_by_friend",
        sourceImageUrl: null,
        frontImageUrl: null
      }
    ],
    assets: [
      {
        petId: "pet_white",
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/white-idle.mp4"
      }
    ]
  });

  assert.equal(bundle.pets[0].ownership, "away");
  assert.equal(bundle.pets[0].displayState, "unavailable");
});

test("desktop bundle only includes pets owned or hosted by the account", () => {
  const bundle = buildDesktopPetBundle({
    generatedAt: "2026-06-16T08:00:00.000Z",
    account: {
      id: "user_demo",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 10120
    },
    pets: [
      {
        id: "pet_orange",
        petNumber: "CAT-20260616-0001",
        ownerUserId: "user_demo",
        currentHostUserId: "user_demo",
        name: "栗子",
        type: "cat",
        status: "在我的桌面",
        materialsReady: 1,
        mood: "好奇",
        host: "me",
        ownership: "owned",
        locationStatus: "at_owner_desktop",
        sourceImageUrl: null,
        frontImageUrl: null
      },
      {
        id: "pet_hosted",
        petNumber: "CAT-20260616-0003",
        ownerUserId: "friend_1",
        currentHostUserId: "user_demo",
        name: "奶盖",
        type: "cat",
        status: "寄养在我的桌面",
        materialsReady: 1,
        mood: "开心",
        host: "me",
        ownership: "hosted",
        locationStatus: "at_owner_desktop",
        sourceImageUrl: null,
        frontImageUrl: null
      },
      {
        id: "pet_other",
        petNumber: "CAT-20260616-0004",
        ownerUserId: "other_user",
        currentHostUserId: "other_user",
        name: "路过猫",
        type: "cat",
        status: "不属于当前账号",
        materialsReady: 1,
        mood: "安静",
        host: "me",
        ownership: "owned",
        locationStatus: "at_owner_desktop",
        sourceImageUrl: null,
        frontImageUrl: null
      }
    ],
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

  assert.deepEqual(
    bundle.pets.map((pet) => pet.id),
    ["pet_orange", "pet_hosted"]
  );
});
