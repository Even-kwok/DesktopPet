import type {
  CurrentUser,
  DesktopEvent,
  DesktopEventType,
  Friend,
  GenerationJob,
  GenerationJobStatus,
  HostingRequestAction,
  HostingRequest,
  HostingRequestStatusCode,
  Pet,
  PetAsset,
  PetAssetStatus,
  RechargeRecord,
  ReferralCode,
  ReferralRewardLedgerEntry,
  UserReferral
} from "./types";
import { isReadonlyPet, sortPetsForAccount } from "./starter-pet.ts";

export type AccountDataState = {
  users: CurrentUser[];
  pets: Pet[];
  assets: PetAsset[];
  generationJobs: GenerationJob[];
  friends: Friend[];
  hostingRequests: HostingRequest[];
  desktopEvents: DesktopEvent[];
  referralCodes: ReferralCode[];
  userReferrals: UserReferral[];
  referralRewardLedger: ReferralRewardLedgerEntry[];
  rechargeRecords: RechargeRecord[];
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

export type HostingRequestInput = {
  id?: string;
  petId: string;
  toUserId: string;
};

export type HostingRequestUpdateInput = {
  requestId: string;
  action: HostingRequestAction;
};

export type AdminCreditAdjustmentResult = {
  userId: string;
  amount: number;
  reason: string;
  previousBalance: number;
  balance: number;
  adjustedAt: string;
};

export type AdminUserDeleteResult = {
  deletedUserId: string;
  deletedPets: number;
  deletedAssets: number;
};

export const defaultGenerationJobTimeoutMs = 30 * 60 * 1000;
export const staleGenerationJobMessage =
  "这次生成等得有点久，先暂时停下；如果积分已经扣了，请刷新生成记录或联系小助手处理。";

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
    hostingRequests: cloneArray(input.hostingRequests ?? []),
    desktopEvents: cloneArray(input.desktopEvents ?? []),
    referralCodes: cloneArray(input.referralCodes ?? []),
    userReferrals: cloneArray(input.userReferrals ?? []),
    referralRewardLedger: cloneArray(input.referralRewardLedger ?? []),
    rechargeRecords: cloneArray(input.rechargeRecords ?? [])
  };
}

export function loadMockAccountDataSnapshot(
  account: CurrentUser,
  state: AccountDataState
): AccountDataSnapshot {
  const user = state.users.find((item) => item.id === account.id || item.email === account.email) ?? account;
  const usersById = new Map(state.users.map((item) => [item.id, item]));
  const visiblePets = sortPetsForAccount(state.pets.filter((pet) => canAccountSeePet(account, pet)))
    .map((pet) => petForAccount(user, pet, usersById.get(pet.ownerUserId)));
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
    hostingRequests: hostingRequestsForAccount(state, user),
    desktopEvents: desktopEventsForAccount(state, user),
    referralCodes: cloneArray(state.referralCodes),
    userReferrals: cloneArray(state.userReferrals),
    referralRewardLedger: cloneArray(state.referralRewardLedger),
    rechargeRecords: cloneArray(state.rechargeRecords)
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

export function deleteUserFromState(
  state: AccountDataState,
  userId: string
): AdminUserDeleteResult {
  const user = state.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const deletedPetIds = new Set(
    state.pets.filter((pet) => pet.ownerUserId === userId).map((pet) => pet.id)
  );
  const deletedReferralCodeIds = new Set(
    state.referralCodes
      .filter((code) => code.ownerUserId === userId || code.createdByUserId === userId)
      .map((code) => code.id)
  );
  const beforeAssetCount = state.assets.length;

  state.users = state.users.filter((item) => item.id !== userId);
  state.pets = state.pets
    .filter((pet) => !deletedPetIds.has(pet.id))
    .map((pet) =>
      pet.currentHostUserId === userId
        ? {
            ...pet,
            currentHostUserId: null,
            host: "away",
            ownership: "away",
            locationStatus: "away",
            status: "暂未显示"
          }
        : pet
    );
  state.assets = state.assets.filter((asset) => !deletedPetIds.has(asset.petId));
  state.generationJobs = state.generationJobs.filter((job) => !deletedPetIds.has(job.petId));
  state.friends = state.friends.filter((friend) => friend.id !== userId);
  state.referralCodes = state.referralCodes.filter(
    (code) => code.ownerUserId !== userId && code.createdByUserId !== userId
  );
  state.userReferrals = state.userReferrals.filter(
    (referral) =>
      referral.referredUserId !== userId &&
      referral.referrerUserId !== userId &&
      !deletedReferralCodeIds.has(referral.referralCodeId)
  );
  state.referralRewardLedger = state.referralRewardLedger.filter(
    (reward) =>
      reward.referredUserId !== userId &&
      reward.referrerUserId !== userId &&
      !deletedReferralCodeIds.has(reward.referralCodeId)
  );
  state.rechargeRecords = state.rechargeRecords.filter(
    (record) =>
      record.userId !== userId &&
      record.referredByUserId !== userId &&
      !deletedReferralCodeIds.has(record.referralCodeId ?? "")
  );

  return {
    deletedUserId: userId,
    deletedPets: deletedPetIds.size,
    deletedAssets: beforeAssetCount - state.assets.length
  };
}

export function createPetInState(
  state: AccountDataState,
  account: CurrentUser,
  input: PetCreateInput = {}
): Pet {
  const ownedEditablePetCount = state.pets.filter(
    (pet) => pet.ownerUserId === account.id && !isReadonlyPet(pet)
  ).length;
  const pet: Pet = {
    id: input.id ?? `pet_${globalThis.crypto.randomUUID()}`,
    petNumber: nextPetNumber(state.pets, input.now ?? new Date()),
    ownerUserId: account.id,
    currentHostUserId: account.id,
    name: cleanPetName(input.name) ?? `猫咪 ${ownedEditablePetCount + 1}`,
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

  const starterPetIndex = state.pets.findIndex(
    (item) => item.ownerUserId === account.id && isReadonlyPet(item)
  );

  if (starterPetIndex >= 0) {
    state.pets.splice(starterPetIndex, 0, pet);
  } else {
    state.pets.push(pet);
  }

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

export function createHostingRequestInState(
  state: AccountDataState,
  account: CurrentUser,
  input: HostingRequestInput
): HostingRequest {
  const requestedPet = state.pets.find((item) => item.id === input.petId);
  const targetUser = state.users.find((user) => user.id === input.toUserId);
  const friend = state.friends.find((item) => item.id === input.toUserId);

  if (!requestedPet || requestedPet.ownerUserId !== account.id) {
    throw new Error("HOSTING_PET_NOT_FOUND");
  }

  if (requestedPet.currentHostUserId !== account.id) {
    throw new Error("HOSTING_PET_UNAVAILABLE");
  }

  if (!targetUser || !friend) {
    throw new Error("HOSTING_FRIEND_NOT_FOUND");
  }

  const request: HostingRequest = {
    id: input.id ?? `hosting_${globalThis.crypto.randomUUID()}`,
    petId: requestedPet.id,
    fromUserId: account.id,
    toUserId: targetUser.id,
    petName: requestedPet.name,
    from: account.name,
    status: "pending",
    statusCode: "pending"
  };

  state.hostingRequests.unshift(request);
  enqueueDesktopEvent(state, {
    userId: request.toUserId,
    type: "hosting_request_created",
    actorUserId: request.fromUserId,
    petId: request.petId,
    hostingRequestId: request.id
  });
  return hostingRequestForAccount(request, account, state);
}

export function desktopEventsForAccount(
  state: AccountDataState,
  account: CurrentUser,
  afterId?: string | null
): DesktopEvent[] {
  const afterNumber = numericEventId(afterId);

  return state.desktopEvents
    .filter((event) => event.userId === account.id)
    .filter((event) => afterNumber === null || numericEventId(event.id) > afterNumber)
    .sort((left, right) => numericEventId(left.id) - numericEventId(right.id))
    .map((event) => ({ ...event, payload: event.payload ? { ...event.payload } : undefined }));
}

export function hostingRequestsForAccount(
  state: AccountDataState,
  account: CurrentUser
): HostingRequest[] {
  return state.hostingRequests
    .filter((request) => hostingStatusCode(request) === "pending")
    .filter((request) => request.fromUserId === account.id || request.toUserId === account.id)
    .map((request) => hostingRequestForAccount(request, account, state));
}

export function updateHostingRequestInState(
  state: AccountDataState,
  account: CurrentUser,
  input: HostingRequestUpdateInput
): HostingRequest {
  const requestIndex = state.hostingRequests.findIndex(
    (request) =>
      request.id === input.requestId &&
      (request.fromUserId === account.id || request.toUserId === account.id)
  );

  if (requestIndex < 0) {
    throw new Error("HOSTING_REQUEST_NOT_FOUND");
  }

  const request = state.hostingRequests[requestIndex];
  const petIndex = state.pets.findIndex((pet) => pet.id === request.petId);
  const pet = petIndex >= 0 ? state.pets[petIndex] : undefined;

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  if (input.action === "accept") {
    if (request.toUserId !== account.id || hostingStatusCode(request) !== "pending") {
      throw new Error("HOSTING_REQUEST_NOT_FOUND");
    }

    state.hostingRequests[requestIndex] = {
      ...request,
      status: "accepted",
      statusCode: "accepted"
    };
    state.pets[petIndex] = {
      ...pet,
      currentHostUserId: request.toUserId,
      locationStatus: "hosted_by_friend"
    };
    enqueueDesktopEvent(state, {
      userId: request.fromUserId,
      type: "hosting_request_accepted",
      actorUserId: request.toUserId,
      petId: request.petId,
      hostingRequestId: request.id
    });
    enqueueDesktopEvent(state, {
      userId: request.toUserId,
      type: "desktop_bundle_changed",
      actorUserId: request.toUserId,
      petId: request.petId,
      hostingRequestId: request.id
    });
  } else if (input.action === "decline") {
    if (request.toUserId !== account.id || hostingStatusCode(request) !== "pending") {
      throw new Error("HOSTING_REQUEST_NOT_FOUND");
    }

    state.hostingRequests[requestIndex] = {
      ...request,
      status: "declined",
      statusCode: "declined"
    };
    enqueueDesktopEvent(state, {
      userId: request.fromUserId,
      type: "hosting_request_declined",
      actorUserId: request.toUserId,
      petId: request.petId,
      hostingRequestId: request.id
    });
  } else {
    if (request.toUserId !== account.id || hostingStatusCode(request) !== "accepted") {
      throw new Error("HOSTING_REQUEST_NOT_FOUND");
    }

    state.hostingRequests[requestIndex] = {
      ...request,
      status: "returned",
      statusCode: "returned"
    };
    state.pets[petIndex] = {
      ...pet,
      currentHostUserId: request.fromUserId,
      locationStatus: "at_owner_desktop"
    };
    enqueueDesktopEvent(state, {
      userId: request.fromUserId,
      type: "pet_recalled",
      actorUserId: request.toUserId,
      petId: request.petId,
      hostingRequestId: request.id
    });
    enqueueDesktopEvent(state, {
      userId: request.toUserId,
      type: "pet_recalled",
      actorUserId: request.toUserId,
      petId: request.petId,
      hostingRequestId: request.id
    });
  }

  return hostingRequestForAccount(state.hostingRequests[requestIndex], account, state);
}

export function enqueueDesktopEvent(
  state: AccountDataState,
  input: {
    userId: string;
    type: DesktopEventType;
    actorUserId?: string | null;
    petId?: string | null;
    hostingRequestId?: string | null;
    payload?: Record<string, unknown>;
    createdAt?: string;
  }
): DesktopEvent {
  const event: DesktopEvent = {
    id: String(nextDesktopEventId(state)),
    userId: input.userId,
    type: input.type,
    actorUserId: input.actorUserId ?? null,
    petId: input.petId ?? null,
    hostingRequestId: input.hostingRequestId ?? null,
    payload: input.payload ? { ...input.payload } : undefined,
    createdAt: input.createdAt ?? new Date().toISOString()
  };

  state.desktopEvents.push(event);
  return event;
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

  if (isReadonlyPet(pet)) {
    throw new Error("PET_READONLY");
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

  if (isReadonlyPet(pet)) {
    throw new Error("PET_READONLY");
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

  if (isReadonlyPet(state.pets[petIndex])) {
    throw new Error("PET_READONLY");
  }

  state.pets[petIndex] = {
    ...state.pets[petIndex],
    sourceImageUrl: input.imageUrl,
    frontImageUrl: input.imageUrl,
    status: "绿幕形象已就绪"
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

  if (isReadonlyPet(state.pets[petIndex])) {
    throw new Error("PET_READONLY");
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

function petForAccount(account: CurrentUser, pet: Pet, owner?: CurrentUser): Pet {
  const ownership = ownershipForAccount(account, pet);
  return {
    ...pet,
    ownerName: owner?.name ?? pet.ownerName ?? null,
    ownerEmail: owner?.email ?? pet.ownerEmail ?? null,
    ownership,
    host: ownership === "away" ? "friend" : "me",
    status: petStatusForAccount(pet, ownership)
  };
}

function ownershipForAccount(account: CurrentUser, pet: Pet): Pet["ownership"] {
  if (pet.ownerUserId !== account.id && pet.currentHostUserId === account.id) {
    return "hosted";
  }

  if (pet.ownerUserId === account.id && pet.currentHostUserId !== account.id) {
    return "away";
  }

  return "owned";
}

function petStatusForAccount(pet: Pet, ownership: Pet["ownership"]) {
  if (ownership === "hosted") {
    return "寄养在我的桌面";
  }

  if (ownership === "away" || pet.locationStatus === "hosted_by_friend") {
    return "托管在朋友家";
  }

  if (pet.locationStatus === "away") {
    return "暂未显示";
  }

  return "在我的桌面";
}

function hostingRequestForAccount(
  request: HostingRequest,
  account: CurrentUser,
  state: AccountDataState
): HostingRequest {
  const sender = state.users.find((user) => user.id === request.fromUserId);
  const receiver = state.users.find((user) => user.id === request.toUserId);
  const pet = state.pets.find((item) => item.id === request.petId);
  const statusCode = hostingStatusCode(request);

  return {
    ...request,
    petName: pet?.name ?? request.petName,
    from: request.fromUserId === account.id ? "你" : sender?.name ?? request.from,
    status: hostingStatusText({
      statusCode,
      isReceiver: request.toUserId === account.id,
      receiverName: receiver?.name ?? "好友"
    }),
    statusCode
  };
}

function hostingStatusCode(request: HostingRequest): HostingRequestStatusCode {
  if (isHostingRequestStatusCode(request.statusCode)) {
    return request.statusCode;
  }

  switch (request.status) {
    case "accepted":
    case "已接收托管":
      return "accepted";
    case "declined":
    case "已拒绝":
      return "declined";
    case "returned":
    case "已送回主人":
      return "returned";
    default:
      return "pending";
  }
}

function isHostingRequestStatusCode(value: string): value is HostingRequestStatusCode {
  return value === "pending" || value === "accepted" || value === "declined" || value === "returned";
}

function hostingStatusText(input: {
  statusCode: HostingRequestStatusCode;
  isReceiver: boolean;
  receiverName: string;
}) {
  switch (input.statusCode) {
    case "pending":
      return input.isReceiver ? "等待你接收" : `等待 ${input.receiverName} 接收`;
    case "accepted":
      return "已接收托管";
    case "declined":
      return "已拒绝";
    case "returned":
      return "已送回主人";
  }
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
        message: "绿幕形象已更新，这次生成先停下。"
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

function nextDesktopEventId(state: AccountDataState) {
  return state.desktopEvents.reduce(
    (nextId, event) => Math.max(nextId, numericEventId(event.id) + 1),
    1
  );
}

function numericEventId(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}
