import type {
  CurrentUser,
  Friend,
  GenerationJob,
  GenerationJobStatus,
  HostingRequest,
  Pet,
  PetAsset,
  PetAssetStatus
} from "./types";

export type AccountDataState = {
  users: CurrentUser[];
  pets: Pet[];
  assets: PetAsset[];
  generationJobs: GenerationJob[];
  friends: Friend[];
  hostingRequests: HostingRequest[];
};

export type AccountDataSnapshot = AccountDataState & {
  user: CurrentUser;
};

export type PetDeleteResult = {
  deletedPetId: string;
  deletedAssets: number;
};

export type PetCreateInput = {
  id?: string;
  name?: string;
  now?: Date;
};

export type FriendDeleteResult = {
  deletedFriendId: string;
};

export type AdminCreditAdjustmentResult = {
  userId: string;
  amount: number;
  reason: string;
  previousBalance: number;
  balance: number;
  adjustedAt: string;
};

export const defaultGenerationJobTimeoutMs = 30 * 60 * 1000;
export const staleGenerationJobMessage =
  "生成任务超过等待时间未返回结果，已暂时标记为超时；如 API 已扣费，请刷新任务队列或联系管理员恢复结果。";

const validAssetStatuses = new Set<PetAssetStatus>([
  "missing",
  "queued",
  "generating",
  "ready",
  "failed"
]);

export function createMockAccountDataState(input: Partial<AccountDataState>): AccountDataState {
  return {
    users: cloneArray(input.users ?? []),
    pets: cloneArray(input.pets ?? []),
    assets: normalizePetAssets(input.assets ?? []),
    generationJobs: cloneArray(input.generationJobs ?? []),
    friends: cloneArray(input.friends ?? []),
    hostingRequests: cloneArray(input.hostingRequests ?? [])
  };
}

export function loadMockAccountDataSnapshot(
  account: CurrentUser,
  state: AccountDataState
): AccountDataSnapshot {
  const user = state.users.find((item) => item.id === account.id || item.email === account.email) ?? account;
  const visiblePets = state.pets.filter((pet) => canAccountSeePet(account, pet));
  const visiblePetIds = new Set(visiblePets.map((pet) => pet.id));
  const visibleAssets = state.assets.filter((asset) => visiblePetIds.has(asset.petId));
  const visibleJobs = state.generationJobs.filter(
    (job) => job.petId && visiblePetIds.has(job.petId)
  );

  return {
    user,
    users: [user],
    pets: withMaterialCounts(visiblePets, visibleAssets),
    assets: visibleAssets,
    generationJobs: visibleJobs,
    friends: cloneArray(state.friends),
    hostingRequests: cloneArray(state.hostingRequests)
  };
}

export function deletePetFromState(
  state: AccountDataState,
  account: CurrentUser,
  petId: string
): PetDeleteResult {
  const pet = state.pets.find((item) => item.id === petId && item.ownerUserId === account.id);

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  const beforeAssetCount = state.assets.length;
  state.assets = state.assets.filter((asset) => asset.petId !== pet.id);
  state.generationJobs = state.generationJobs.filter((job) => job.petId !== pet.id);
  state.pets = state.pets.filter((item) => item.id !== pet.id);

  return {
    deletedPetId: pet.id,
    deletedAssets: beforeAssetCount - state.assets.length
  };
}

export function createPetInState(
  state: AccountDataState,
  account: CurrentUser,
  input: PetCreateInput = {}
): Pet {
  const ownedPetCount = state.pets.filter((pet) => pet.ownerUserId === account.id).length;
  const pet: Pet = {
    id: input.id ?? `pet_${globalThis.crypto.randomUUID()}`,
    petNumber: nextPetNumber(state.pets, input.now ?? new Date()),
    ownerUserId: account.id,
    currentHostUserId: account.id,
    name: cleanPetName(input.name) ?? `猫咪 ${ownedPetCount + 1}`,
    type: "cat",
    status: "在我的桌面",
    materialsReady: 0,
    mood: "同步",
    host: "me",
    ownership: "owned",
    locationStatus: "at_owner_desktop",
    sourceImageUrl: null,
    frontImageUrl: null
  };

  state.pets.push(pet);
  return pet;
}

export function addFriendToState(
  state: AccountDataState,
  account: CurrentUser,
  email: string
): Friend {
  const friendEmail = cleanFriendEmail(email);

  if (!friendEmail) {
    throw new Error("FRIEND_EMAIL_REQUIRED");
  }

  const friendUser = state.users.find((user) => user.email.toLowerCase() === friendEmail);

  if (!friendUser || friendUser.id === account.id) {
    throw new Error("FRIEND_NOT_FOUND");
  }

  const existingFriend = state.friends.find((friend) => friend.id === friendUser.id);

  if (existingFriend) {
    return existingFriend;
  }

  const friend: Friend = {
    id: friendUser.id,
    name: friendUser.name,
    status: "离线",
    hostedPets: state.pets.filter(
      (pet) => pet.ownerUserId === account.id && pet.currentHostUserId === friendUser.id
    ).length
  };

  state.friends.push(friend);
  return friend;
}

export function removeFriendFromState(
  state: AccountDataState,
  friendId: string
): FriendDeleteResult {
  const beforeCount = state.friends.length;

  state.friends = state.friends.filter((friend) => friend.id !== friendId);

  if (state.friends.length === beforeCount) {
    throw new Error("FRIEND_NOT_FOUND");
  }

  return {
    deletedFriendId: friendId
  };
}

export function updateUserProfileInState(
  state: AccountDataState,
  account: CurrentUser,
  input: {
    name: string;
  }
): CurrentUser {
  const name = cleanUserName(input.name);

  if (!name) {
    throw new Error("DISPLAY_NAME_REQUIRED");
  }

  const userIndex = state.users.findIndex(
    (user) => user.id === account.id || user.email.toLowerCase() === account.email.toLowerCase()
  );

  if (userIndex < 0) {
    throw new Error("USER_NOT_FOUND");
  }

  state.users[userIndex] = {
    ...state.users[userIndex],
    name
  };
  state.friends = state.friends.map((friend) =>
    friend.id === state.users[userIndex].id ? { ...friend, name } : friend
  );

  return state.users[userIndex];
}

export function adjustUserCreditsInState(
  state: AccountDataState,
  input: {
    userId: string;
    amount: number;
    reason: string;
    now?: Date;
  }
): AdminCreditAdjustmentResult {
  const amount = cleanCreditAdjustmentAmount(input.amount);
  const reason = cleanCreditAdjustmentReason(input.reason);

  if (!reason) {
    throw new Error("CREDIT_ADJUSTMENT_REASON_REQUIRED");
  }

  const userIndex = state.users.findIndex((user) => user.id === input.userId);

  if (userIndex < 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const previousBalance = Math.max(0, state.users[userIndex].credits);
  const balance = Math.max(previousBalance + amount, 0);
  const appliedAmount = balance - previousBalance;

  state.users[userIndex] = {
    ...state.users[userIndex],
    credits: balance
  };

  return {
    userId: state.users[userIndex].id,
    amount: appliedAmount,
    reason,
    previousBalance,
    balance,
    adjustedAt: (input.now ?? new Date()).toISOString()
  };
}

export function upsertPetAssetInState(
  state: AccountDataState,
  account: CurrentUser,
  input: {
    petId: string;
    slot: string;
    videoUrl: string;
  }
): PetAsset {
  const pet = state.pets.find((item) => item.id === input.petId && canAccountSeePet(account, item));

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  const asset: PetAsset = {
    petId: input.petId,
    slot: input.slot,
    status: "ready",
    videoUrl: input.videoUrl
  };
  const index = state.assets.findIndex(
    (item) => item.petId === input.petId && item.slot === input.slot
  );

  if (index >= 0) {
    state.assets[index] = asset;
  } else {
    state.assets.push(asset);
  }

  state.assets = normalizePetAssets(state.assets);
  return asset;
}

export function createGenerationJobInState(
  state: AccountDataState,
  account: CurrentUser,
  job: GenerationJob
): GenerationJob {
  const pet = state.pets.find((item) => item.id === job.petId && canAccountSeePet(account, item));

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  const activeJob = findActiveGenerationJobInState(state, account, {
    petId: job.petId,
    slot: job.slot,
    type: job.type
  });

  if (activeJob) {
    return activeJob;
  }

  const persistedJob: GenerationJob = {
    ...job,
    status: normalizeGenerationJobStatus(job.status),
    createdAt: job.createdAt ?? new Date().toISOString()
  };

  state.generationJobs = [persistedJob, ...state.generationJobs.filter((item) => item.jobId !== job.jobId)];

  if (job.type === "action_video" && job.slot) {
    const existingAsset = state.assets.find(
      (asset) => asset.petId === job.petId && asset.slot === job.slot
    );

    state.assets = normalizePetAssets([
      {
        petId: job.petId,
        slot: job.slot,
        status: existingAsset?.videoUrl ? "ready" : "generating",
        videoUrl: existingAsset?.videoUrl ?? null
      },
      ...state.assets.filter((asset) => !(asset.petId === job.petId && asset.slot === job.slot))
    ]);
  }

  const userIndex = state.users.findIndex((user) => user.id === account.id);

  if (userIndex >= 0) {
    state.users[userIndex] = {
      ...state.users[userIndex],
      credits: Math.max(state.users[userIndex].credits - job.cost, 0)
    };
  }

  return persistedJob;
}

export function findActiveGenerationJobInState(
  state: AccountDataState,
  account: CurrentUser,
  input: {
    petId: string;
    slot?: string;
    type?: GenerationJob["type"];
  }
): GenerationJob | null {
  const pet = state.pets.find((item) => item.id === input.petId && canAccountSeePet(account, item));

  if (!pet) {
    return null;
  }

  const activeJobs = state.generationJobs
    .filter(
      (job) =>
        job.petId === input.petId &&
        (input.type ? job.type === input.type : true) &&
        (job.slot ?? null) === (input.slot ?? null) &&
        isActiveGenerationStatus(normalizeGenerationJobStatus(job.status))
    )
    .sort((left, right) => Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? ""));

  return activeJobs[0] ?? null;
}

export function updateGenerationJobInState(
  state: AccountDataState,
  account: CurrentUser,
  job: GenerationJob
): GenerationJob {
  const index = state.generationJobs.findIndex((item) => item.jobId === job.jobId);
  const existing = index >= 0 ? state.generationJobs[index] : job;
  const shouldRefundCredits =
    isActiveGenerationStatus(normalizeGenerationJobStatus(existing.status)) &&
    isRefundableTerminalStatus(job.status) &&
    existing.cost > 0;
  const mergedJob: GenerationJob = {
    ...existing,
    ...job,
    petId: existing.petId,
    slot: existing.slot,
    cost: existing.cost,
    status: normalizeGenerationJobStatus(job.status),
    resultUrl: job.resultUrl ?? existing.resultUrl ?? null
  };

  if (index >= 0) {
    state.generationJobs[index] = mergedJob;
  } else {
    state.generationJobs.unshift(mergedJob);
  }

  if (mergedJob.type === "action_video" && mergedJob.slot) {
    const pet = state.pets.find((item) => item.id === mergedJob.petId && canAccountSeePet(account, item));

    if (!pet) {
      throw new Error("PET_NOT_FOUND");
    }

    const existingAsset = state.assets.find(
      (asset) => asset.petId === mergedJob.petId && asset.slot === mergedJob.slot
    );
    const existingVideoUrl = existingAsset?.videoUrl ?? null;
    const isFailedTerminalStatus = mergedJob.status === "failed" || mergedJob.status === "expired";
    const assetStatus = mergedJob.status === "succeeded"
      ? "ready"
      : existingVideoUrl
        ? "ready"
        : isFailedTerminalStatus
          ? "failed"
          : "generating";
    const videoUrl = mergedJob.status === "succeeded"
      ? mergedJob.resultUrl ?? null
      : existingVideoUrl;

    state.assets = normalizePetAssets([
      {
        petId: mergedJob.petId,
        slot: mergedJob.slot,
        status: assetStatus,
        videoUrl
      },
      ...state.assets.filter((asset) => !(asset.petId === mergedJob.petId && asset.slot === mergedJob.slot))
    ]);
  }

  if (shouldRefundCredits) {
    refundGenerationJobCreditsInState(state, account, existing.cost);
  }

  return mergedJob;
}

export function expireStaleGenerationJobsInState(
  state: AccountDataState,
  account: CurrentUser,
  input: {
    now?: Date;
    timeoutMs?: number;
  } = {}
): GenerationJob[] {
  const now = input.now ?? new Date();
  const timeoutMs = input.timeoutMs ?? defaultGenerationJobTimeoutMs;
  const nowMs = now.getTime();

  if (!Number.isFinite(nowMs) || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return [];
  }

  const visiblePetIds = new Set(
    state.pets.filter((pet) => canAccountSeePet(account, pet)).map((pet) => pet.id)
  );
  const expiredJobs: GenerationJob[] = [];
  const expiredAssetKeys = new Set<string>();
  let refundCredits = 0;

  state.generationJobs = state.generationJobs.map((job) => {
    if (!job.petId || !visiblePetIds.has(job.petId)) {
      return job;
    }

    if (!isActiveGenerationStatus(normalizeGenerationJobStatus(job.status))) {
      return job;
    }

    const createdAtMs = job.createdAt ? Date.parse(job.createdAt) : NaN;

    if (!Number.isFinite(createdAtMs) || nowMs - createdAtMs < timeoutMs) {
      return job;
    }

    const expiredJob: GenerationJob = {
      ...job,
      status: "expired",
      progress: 100,
      message: staleGenerationJobMessage
    };

    expiredJobs.push(expiredJob);
    refundCredits += Math.max(job.cost, 0);

    if (expiredJob.type === "action_video" && expiredJob.slot) {
      expiredAssetKeys.add(generationAssetKey(expiredJob.petId, expiredJob.slot));
    }

    return expiredJob;
  });

  if (expiredAssetKeys.size > 0) {
    state.assets = normalizePetAssets(
      state.assets.map((asset) => {
        if (!expiredAssetKeys.has(generationAssetKey(asset.petId, asset.slot)) || asset.videoUrl) {
          return asset;
        }

        return {
          ...asset,
          status: "failed"
        };
      })
    );
  }

  if (refundCredits > 0) {
    refundGenerationJobCreditsInState(state, account, refundCredits);
  }

  return expiredJobs;
}

export function updatePetImagesInState(
  state: AccountDataState,
  account: CurrentUser,
  input: {
    petId: string;
    imageUrl: string;
  }
): Pet {
  const petIndex = state.pets.findIndex(
    (item) => item.id === input.petId && item.ownerUserId === account.id
  );

  if (petIndex < 0) {
    throw new Error("PET_NOT_FOUND");
  }

  state.pets[petIndex] = {
    ...state.pets[petIndex],
    sourceImageUrl: input.imageUrl,
    frontImageUrl: input.imageUrl,
    status: "首尾帧形象已就绪"
  };
  retireActiveActionJobsForPet(state, input.petId);

  return state.pets[petIndex];
}

export function updatePetNameInState(
  state: AccountDataState,
  account: CurrentUser,
  input: {
    petId: string;
    name: string;
  }
): Pet {
  const name = cleanPetName(input.name);

  if (!name) {
    throw new Error("PET_NAME_REQUIRED");
  }

  const petIndex = state.pets.findIndex(
    (item) => item.id === input.petId && item.ownerUserId === account.id
  );

  if (petIndex < 0) {
    throw new Error("PET_NOT_FOUND");
  }

  state.pets[petIndex] = {
    ...state.pets[petIndex],
    name
  };

  return state.pets[petIndex];
}

export function normalizePetAssets(assets: PetAsset[]): PetAsset[] {
  return assets.map((asset) => {
    const videoUrl = typeof asset.videoUrl === "string" && asset.videoUrl.length > 0
      ? asset.videoUrl
      : null;
    const status = validAssetStatuses.has(asset.status) ? asset.status : "missing";

    return {
      ...asset,
      status: status === "ready" && !videoUrl ? "missing" : status,
      videoUrl
    };
  });
}

export function withMaterialCounts(pets: Pet[], assets: PetAsset[]): Pet[] {
  return pets.map((pet) => ({
    ...pet,
    materialsReady: assets.filter((asset) => asset.petId === pet.id && asset.status === "ready").length
  }));
}

export function canAccountSeePet(account: CurrentUser, pet: Pet) {
  return pet.ownerUserId === account.id || pet.currentHostUserId === account.id;
}

function cloneArray<T>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

export function nextPetNumber(pets: Pick<Pet, "petNumber">[], now: Date = new Date()) {
  const prefix = `CAT-${dateKey(now)}-`;
  const maxSequence = pets.reduce((max, pet) => {
    if (!pet.petNumber.startsWith(prefix)) {
      return max;
    }

    const sequence = Number(pet.petNumber.slice(prefix.length));

    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;
}

function dateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function cleanPetName(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, 30) : null;
}

function cleanUserName(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, 30) : null;
}

function cleanCreditAdjustmentAmount(value: number) {
  if (!Number.isInteger(value) || value === 0) {
    throw new Error("CREDIT_ADJUSTMENT_AMOUNT_REQUIRED");
  }

  return value;
}

function cleanCreditAdjustmentReason(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 160) : null;
}

function cleanFriendEmail(value: string) {
  const trimmed = value.trim().toLowerCase();

  return trimmed ? trimmed.slice(0, 320) : null;
}

function generationAssetKey(petId: string, slot: string) {
  return `${petId}:${slot}`;
}

function refundGenerationJobCreditsInState(
  state: AccountDataState,
  account: CurrentUser,
  amount: number
) {
  const userIndex = state.users.findIndex((user) => user.id === account.id);

  if (userIndex < 0 || amount <= 0) {
    return;
  }

  state.users[userIndex] = {
    ...state.users[userIndex],
    credits: state.users[userIndex].credits + amount
  };
}

function isRefundableTerminalStatus(status: GenerationJobStatus) {
  return status === "failed" || status === "expired";
}

function retireActiveActionJobsForPet(state: AccountDataState, petId: string) {
  const retiredSlots = new Set<string>();
  let refundCredits = 0;

  state.generationJobs = state.generationJobs.map((job) => {
    if (
      job.petId === petId &&
      job.type === "action_video" &&
      isActiveGenerationStatus(normalizeGenerationJobStatus(job.status))
    ) {
      if (job.slot) {
        retiredSlots.add(job.slot);
      }
      refundCredits += Math.max(job.cost, 0);

      return {
        ...job,
        status: "expired",
        progress: 100,
        message: "源图已更新，本次任务已作废。"
      };
    }

    return job;
  });

  if (retiredSlots.size === 0) {
    return;
  }

  state.assets = normalizePetAssets(
    state.assets.map((asset) => {
      if (asset.petId !== petId || !retiredSlots.has(asset.slot) || asset.videoUrl) {
        return asset;
      }

      return {
        ...asset,
        status: "failed"
      };
    })
  );

  if (refundCredits > 0) {
    const account = state.users.find((user) =>
      state.pets.some((pet) => pet.id === petId && pet.ownerUserId === user.id)
    );

    if (account) {
      refundGenerationJobCreditsInState(state, account, refundCredits);
    }
  }
}

function normalizeGenerationJobStatus(status: GenerationJobStatus): GenerationJobStatus {
  return status === "queued" ? "running" : status;
}

function isActiveGenerationStatus(status: GenerationJobStatus) {
  return status === "queued" || status === "running";
}
