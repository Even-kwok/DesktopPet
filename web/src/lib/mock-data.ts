import { materialSlots } from "./material-slots.ts";
import { getStarterPetSeed } from "./starter-pet-seed.ts";
import type {
  CurrentUser,
  Friend,
  HostingRequest,
  Pet,
  PetAsset,
  RechargeRecord,
  ReferralCode,
  ReferralRewardLedgerEntry,
  UserReferral
} from "./types.ts";

export const currentUser: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "栗子主人",
  email: "demo@desktop.pet",
  credits: 10120
};

export const referredUser: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000201",
  name: "推荐来的朋友",
  email: "friend-referral@desktop.pet",
  credits: 1200
};

const starterPetSeed = getStarterPetSeed();
const starterPetAssetUrls = new Map(
  starterPetSeed.assets.map((asset) => [asset.slot, asset.videoUrl])
);

export const pets: Pet[] = [
  {
    id: "pet_orange",
    petNumber: "CAT-20260616-0001",
    ownerUserId: currentUser.id,
    currentHostUserId: currentUser.id,
    name: starterPetSeed.name,
    type: "cat",
    status: "在我的桌面",
    materialsReady: starterPetSeed.assets.length,
    mood: "好奇",
    host: "me",
    ownership: "owned",
    locationStatus: "at_owner_desktop",
    sourceImageUrl: starterPetSeed.imageUrl,
    frontImageUrl: starterPetSeed.imageUrl,
    isReadonly: true
  },
  {
    id: "pet_white",
    petNumber: "CAT-20260616-0002",
    ownerUserId: currentUser.id,
    currentHostUserId: "00000000-0000-4000-8000-000000000101",
    name: "雪球",
    type: "cat",
    status: "托管在朋友家",
    materialsReady: 5,
    mood: "犯困",
    host: "friend",
    ownership: "away",
    locationStatus: "hosted_by_friend",
    sourceImageUrl: null,
    frontImageUrl: null
  }
];

export const friends: Friend[] = [
  { id: "00000000-0000-4000-8000-000000000101", name: "Mika", status: "在线", hostedPets: 1 },
  { id: "00000000-0000-4000-8000-000000000102", name: "小北", status: "离线", hostedPets: 0 }
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
  materialSlots.map((slot) => {
    const starterVideoUrl = pet.id === "pet_orange" ? starterPetAssetUrls.get(slot.id) : null;

    return {
      petId: pet.id,
      slot: slot.id,
      status: starterVideoUrl || (pet.id === "pet_orange" && readyMaterialIds.has(slot.id))
        ? "ready"
        : "missing",
      videoUrl: starterVideoUrl ?? null
    };
  })
);

export const referralCodes: ReferralCode[] = [
  {
    id: "refcode_lizi20",
    code: "LIZI20",
    ownerUserId: currentUser.id,
    ownerName: currentUser.name,
    ownerEmail: currentUser.email,
    status: "active",
    createdByUserId: "admin_demo",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    referredUsers: 1,
    rewardAmountCents: 990,
    rewardCredits: 9
  }
];

export const userReferrals: UserReferral[] = [
  {
    referredUserId: referredUser.id,
    referralCodeId: "refcode_lizi20",
    referralCode: "LIZI20",
    referrerUserId: currentUser.id,
    registeredAt: "2026-06-23T00:00:00.000Z",
    rewardPercentAtRegistration: 10,
    firstRechargeDiscountPercentAtRegistration: 20,
    firstRechargeDiscountUsedAt: "2026-06-23T01:00:00.000Z"
  }
];

export const rechargeRecords: RechargeRecord[] = [
  {
    id: "recharge_referral_demo",
    userId: referredUser.id,
    provider: "mock",
    providerTransactionId: "mock_recharge_referral_demo",
    amountCents: 9900,
    currency: "CNY",
    creditsGranted: 1200,
    status: "paid",
    discountPercent: 20,
    discountAmountCents: 1980,
    referralCodeId: "refcode_lizi20",
    referredByUserId: currentUser.id,
    paidAt: "2026-06-23T01:00:00.000Z",
    note: "推荐首充示例",
    createdAt: "2026-06-23T01:00:00.000Z",
    updatedAt: "2026-06-23T01:00:00.000Z"
  }
];

export const referralRewardLedger: ReferralRewardLedgerEntry[] = [
  {
    id: "reward_referral_demo",
    referrerUserId: currentUser.id,
    referrerName: currentUser.name,
    referrerEmail: currentUser.email,
    referredUserId: referredUser.id,
    referredUserName: referredUser.name,
    referredUserEmail: referredUser.email,
    referralCodeId: "refcode_lizi20",
    referralCode: "LIZI20",
    rechargeRecordId: "recharge_referral_demo",
    amountCents: 9900,
    currency: "CNY",
    rewardPercent: 10,
    rewardAmountCents: 990,
    rewardCredits: 9,
    status: "posted",
    createdAt: "2026-06-23T01:00:00.000Z"
  }
];
