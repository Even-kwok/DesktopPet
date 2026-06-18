import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminOverview } from "./admin-overview.ts";
import { materialGroups, materialSlots } from "./material-slots.ts";
import type { CurrentUser, Friend, HostingRequest, Pet, PetAsset } from "./types.ts";

test("admin overview groups account, pet, material, credit, recharge, friend, hosting, and slot data", () => {
  const currentUser: CurrentUser = {
    id: "user_demo",
    name: "栗子主人",
    email: "demo@desktop.pet",
    credits: 10120
  };
  const pets: Pet[] = [
    {
      id: "pet_orange",
      petNumber: "CAT-20260616-0001",
      ownerUserId: currentUser.id,
      currentHostUserId: currentUser.id,
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
    }
  ];
  const petAssets: PetAsset[] = [
    {
      petId: "pet_orange",
      slot: "idle_loop",
      status: "ready",
      videoUrl: "https://example.com/idle.mp4"
    }
  ];
  const friends: Friend[] = [
    { id: "friend_1", name: "Mika", status: "在线", hostedPets: 1 }
  ];
  const hostingRequests: HostingRequest[] = [
    { id: "request_1", petName: "奶盖", from: "Mika", status: "等待你接收" }
  ];

  const overview = buildAdminOverview({
    users: [currentUser],
    pets,
    assets: petAssets,
    friends,
    hostingRequests,
    materialSlots,
    materialGroups
  });

  assert.equal(overview.generatedAt.length > 0, true);
  assert.deepEqual(Object.keys(overview.metrics), [
    "users",
    "pets",
    "totalCredits",
    "rechargeRecords",
    "materialSlots"
  ]);
  assert.equal("readyMaterials" in overview.metrics, false);
  assert.equal(overview.users[0].id, currentUser.id);
  assert.equal(overview.users[0].creditBalance, currentUser.credits);
  assert.equal(overview.users[0].petCount, 1);
  assert.equal(overview.users[0].materialCount, 1);
  assert.equal(overview.users[0].consumedCredits, 18);
  assert.equal(overview.pets[0].petNumber, "CAT-20260616-0001");
  assert.equal(overview.pets[0].ownerUserId, currentUser.id);
  assert.equal(overview.materials.some((material) => material.slot === "idle_loop"), true);
  assert.equal(overview.creditLedger[0].userId, currentUser.id);
  assert.equal(overview.rechargeRecords[0].creditsGranted > 0, true);
  assert.equal(overview.friendships[0].userId, currentUser.id);
  assert.equal(overview.hostingRequests.length, hostingRequests.length);
  assert.equal(overview.materialLibrary[0].code, materialSlots[0].id);
  assert.equal(overview.materialLibrary[0].name, "待机循环");
  assert.equal(overview.materialLibrary[0].generation.costCredits, materialSlots[0].cost);
  assert.equal(overview.materialLibrary[0].generation.durationEditable, true);
  assert.match(overview.materialLibrary[0].generation.costRule, /10s/);
  assert.equal(overview.materialLibrary[0].trigger.label, "默认循环");
  assert.equal(overview.materialLibrary[0].trigger.editable, false);
  assert.equal(overview.materialLibrary[0].trigger.changeRequiresClientRelease, true);
  assert.equal(overview.materialLibrary[0].prompt.editable, true);
  assert.equal(overview.materialLibrary[0].prompt.protected, true);
  assert.equal("content" in overview.materialLibrary[0].prompt, false);

  const coreGroup = overview.materialGroups.find((group) => group.id === "core");
  assert.equal(coreGroup?.name, "基础状态");
  assert.match(coreGroup?.description ?? "", /默认展示/);
  assert.equal(coreGroup?.materials.some((material) => material.code === "idle_loop"), true);
  assert.doesNotMatch(JSON.stringify(overview), /固定摄像机视角|纯绿色背景/);
});
