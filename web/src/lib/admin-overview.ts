import type { MaterialGroup, MaterialSlot } from "./material-slots";
import type { CurrentUser, Friend, HostingRequest, Pet, PetAsset } from "./types";
import { defaultVideoGenerationSettings } from "./generation-settings.ts";

type BuildAdminOverviewInput = {
  users: CurrentUser[];
  pets: Pet[];
  assets: PetAsset[];
  friends: Friend[];
  hostingRequests: HostingRequest[];
  materialSlots: MaterialSlot[];
  materialGroups?: MaterialGroup[];
  generatedAt?: string;
};

export type AdminOverview = ReturnType<typeof buildAdminOverview>;

export function buildAdminOverview(input: BuildAdminOverviewInput) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const materialGroupDefinitions = input.materialGroups ?? inferMaterialGroups(input.materialSlots);
  const materialSlotsById = new Map(input.materialSlots.map((slot) => [slot.id, slot]));
  const materialLibrary = input.materialSlots.map((slot) =>
    buildMaterialLibraryEntry(slot, materialGroupDefinitions)
  );
  const userSummaries = input.users.map((user) =>
    buildUserSummary(user, input.pets, input.assets, materialSlotsById)
  );
  const rechargeRecords = input.users.map((user) => ({
    id: `recharge_${user.id}_demo`,
    userId: user.id,
    provider: "mock",
    providerTransactionId: "mock_checkout_20260616",
    amountCents: 990,
    currency: "CNY",
    creditsGranted: user.credits,
    status: "paid" as const,
    createdAt: "2026-06-16T00:00:00.000Z"
  }));

  return {
    generatedAt,
    metrics: {
      users: input.users.length,
      pets: input.pets.length,
      totalCredits: input.users.reduce((sum, user) => sum + user.credits, 0),
      rechargeRecords: rechargeRecords.length,
      materialSlots: input.materialSlots.length
    },
    users: userSummaries,
    pets: input.pets.map((pet) => ({
      id: pet.id,
      petNumber: pet.petNumber,
      ownerUserId: pet.ownerUserId,
      currentHostUserId: pet.currentHostUserId ?? null,
      name: pet.name,
      type: pet.type,
      status: pet.status,
      ownership: pet.ownership,
      locationStatus: pet.locationStatus,
      materialsReady: pet.materialsReady,
      sourceImageUrl: pet.sourceImageUrl ?? null,
      frontImageUrl: pet.frontImageUrl ?? null
    })),
    materials: input.assets.map((asset) => ({
      petId: asset.petId,
      slot: asset.slot,
      status: asset.status,
      videoUrl: asset.videoUrl ?? null,
      generationProvider: asset.status === "ready" ? "seedance" : null,
      updatedAt: generatedAt
    })),
    creditLedger: input.users.map((user) => ({
      id: `ledger_${user.id}_opening`,
      userId: user.id,
      amount: user.credits,
      reason: "opening_balance",
      createdAt: "2026-06-16T00:00:00.000Z"
    })),
    rechargeRecords,
    friendships: input.friends.map((friend) => ({
      id: `friendship_${friend.id}`,
      userId: input.users[0]?.id ?? "user_demo",
      friendUserId: friend.id,
      friendName: friend.name,
      friendStatus: friend.status,
      hostedPets: friend.hostedPets,
      status: "accepted" as const,
      createdAt: "2026-06-16T00:00:00.000Z"
    })),
    hostingRequests: input.hostingRequests.map((request) => ({
      id: request.id,
      petName: request.petName,
      from: request.from,
      status: request.status,
      updatedAt: generatedAt
    })),
    materialGroups: materialGroupDefinitions.map((group) =>
      buildMaterialGroup(group, materialLibrary)
    ),
    materialLibrary
  };
}

function buildUserSummary(
  user: CurrentUser,
  pets: Pet[],
  assets: PetAsset[],
  materialSlotsById: Map<string, MaterialSlot>
) {
  const ownedPetIds = new Set(
    pets.filter((pet) => pet.ownerUserId === user.id).map((pet) => pet.id)
  );
  const ownedGeneratedAssets = assets.filter(
    (asset) => ownedPetIds.has(asset.petId) && asset.status !== "missing"
  );
  const consumedCredits = ownedGeneratedAssets.reduce(
    (sum, asset) => sum + (materialSlotsById.get(asset.slot)?.cost ?? 0),
    0
  );

  return {
    id: user.id,
    displayName: user.name,
    email: user.email,
    creditBalance: user.credits,
    petCount: ownedPetIds.size,
    consumedCredits,
    materialCount: ownedGeneratedAssets.length,
    accountStatus: "active" as const,
    createdAt: "2026-06-16T00:00:00.000Z"
  };
}

function buildMaterialGroup(
  group: MaterialGroup,
  materialLibrary: ReturnType<typeof buildMaterialLibraryEntry>[]
) {
  return {
    id: group.id,
    name: group.title,
    description: group.description,
    materials: materialLibrary.filter((material) => material.group.id === group.id)
  };
}

function buildMaterialLibraryEntry(slot: MaterialSlot, groups: MaterialGroup[]) {
  const group = groups.find((item) => item.id === slot.group);
  const creditsPerSecond = Number((slot.cost / slot.durationSeconds).toFixed(2));

  return {
    code: slot.id,
    name: slot.name,
    nameEditable: true,
    group: {
      id: slot.group,
      name: group?.title ?? slot.group,
      description: group?.description ?? ""
    },
    trigger: {
      label: slot.trigger,
      editable: false,
      changeRequiresClientRelease: true,
      note: "触发条件由桌面端交互逻辑决定，后台只展示，不直接改动。"
    },
    enabled: true,
    generation: {
      costCredits: slot.cost,
      durationSeconds: slot.durationSeconds,
      durationEditable: true,
      creditsPerSecond,
      costRule: `${creditsPerSecond} 积分/秒 x ${slot.durationSeconds}s = ${slot.cost} 积分`,
      settings: defaultGenerationSettings(slot.durationSeconds)
    },
    prompt: {
      editable: true,
      protected: true,
      storage: "server" as const,
      reference: `material_prompt:${slot.id}:v1`,
      summary: "完整提示词由后台素材库编辑，用户端和桌面同步不下发明文。"
    }
  };
}

function inferMaterialGroups(slots: MaterialSlot[]): MaterialGroup[] {
  const groupIds = Array.from(new Set(slots.map((slot) => slot.group)));

  return groupIds.map((id) => ({
    id,
    title: id,
    description: "待补充分组说明。",
    color: "muted"
  }));
}

function defaultGenerationSettings(durationSeconds: number) {
  return {
    model: defaultVideoGenerationSettings.model,
    durationSeconds,
    ratio: "adaptive" as const,
    resolution: "720p" as const,
    framesPerSecond: 24 as const,
    cameraFixed: true,
    watermark: false,
    generateAudio: false,
    returnLastFrame: true
  };
}
