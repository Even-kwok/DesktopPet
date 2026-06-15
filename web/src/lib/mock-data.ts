import { materialSlots } from "@/lib/material-slots";
import type { CurrentUser, Friend, HostingRequest, Pet, PetAsset } from "@/lib/types";

export const currentUser: CurrentUser = {
  id: "user_demo",
  name: "栗子主人",
  email: "demo@desktop.pet",
  credits: 120
};

export const pets: Pet[] = [
  {
    id: "pet_orange",
    name: "栗子",
    type: "cat",
    status: "在我的桌面",
    materialsReady: 8,
    mood: "好奇",
    host: "me",
    sourceImageUrl: null,
    frontImageUrl: null
  },
  {
    id: "pet_white",
    name: "雪球",
    type: "cat",
    status: "托管在朋友家",
    materialsReady: 5,
    mood: "犯困",
    host: "friend",
    sourceImageUrl: null,
    frontImageUrl: null
  }
];

export const friends: Friend[] = [
  { id: "friend_1", name: "Mika", status: "在线", hostedPets: 1 },
  { id: "friend_2", name: "小北", status: "离线", hostedPets: 0 }
];

export const hostingRequests: HostingRequest[] = [
  { id: "request_1", petName: "奶盖", from: "Mika", status: "等待你接收" },
  { id: "request_2", petName: "栗子", from: "你", status: "托管给小北中" }
];

export const readyMaterialIds = new Set([
  "idle_loop",
  "sleep_loop",
  "catch_bug",
  "click_react",
  "head_rub_left",
  "angry_swipe_left",
  "yawn",
  "lick_belly"
]);

export const petAssets: PetAsset[] = pets.flatMap((pet) =>
  materialSlots.map((slot) => ({
    petId: pet.id,
    slot: slot.id,
    status: pet.id === "pet_orange" && readyMaterialIds.has(slot.id) ? "ready" : "missing",
    videoUrl: null
  }))
);
