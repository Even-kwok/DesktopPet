import { createClient } from "@supabase/supabase-js";
import {
  addFriendToState,
  adjustUserCreditsInState,
  canAccountSeePet,
  createHostingRequestInState,
  createMockAccountDataState,
  createGenerationJobInState,
  defaultGenerationJobTimeoutMs,
  createPetInState,
  deleteUserFromState,
  deletePetFromState,
  expireStaleGenerationJobsInState,
  findActiveGenerationJobInState,
  hostingRequestsForAccount,
  loadMockAccountDataSnapshot,
  nextPetNumber,
  normalizePetAssets,
  removeFriendFromState,
  staleGenerationJobMessage,
  updateHostingRequestInState,
  updateGenerationJobInState,
  updatePetImagesInState,
  updatePetNameInState,
  updateUserProfileInState,
  upsertPetAssetInState,
  withMaterialCounts,
  type AccountDataSnapshot,
  type AccountDataState,
  type AdminCreditAdjustmentResult,
  type AdminUserDeleteResult,
  type FriendDeleteResult,
  type PetDeleteResult
} from "@/lib/account-data-state";
import { getJimengVideoJob, isJimengJobId } from "@/lib/server/jimeng";
import {
  getMockAccountDataState,
  resetMockAccountDataStateForTests as resetSharedMockAccountDataStateForTests
} from "@/lib/server/mock-account-state";
import { isReadonlyPet, sortPetsForAccount, starterPetAssetBundleUrl } from "@/lib/starter-pet";
import { getBackendStatus, getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CurrentUser,
  Friend,
  GenerationJob,
  GenerationJobStatus,
  HostingRequestAction,
  HostingRequest,
  Pet,
  PetAsset
} from "@/lib/types";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  account_status?: string | null;
};

type CreditBalanceRow = {
  user_id: string;
  balance: number | null;
};

type PetRow = {
  id: string;
  pet_number: string;
  owner_user_id: string;
  current_host_user_id: string | null;
  name: string;
  species: "cat" | "dog";
  avatar_url: string | null;
  source_image_url: string | null;
  front_image_url: string | null;
  asset_bundle_url: string | null;
  location_status: Pet["locationStatus"];
};

type PetAssetRow = {
  pet_id: string;
  slot: string;
  status: PetAsset["status"];
  video_url: string | null;
};

type GenerationJobRow = {
  id: string;
  user_id: string;
  pet_id: string;
  job_type: GenerationJob["type"];
  slot: string | null;
  status: GenerationJobStatus;
  cost: number | null;
  provider: string | null;
  provider_job_id: string | null;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type FriendshipRow = {
  user_a_id: string;
  user_b_id: string;
};

type HostingRequestRow = {
  id: string;
  pet_id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  updated_at?: string | null;
};

const mockAccountState = getMockAccountDataState();

const petSelectColumns =
  "id, pet_number, owner_user_id, current_host_user_id, name, species, avatar_url, source_image_url, front_image_url, asset_bundle_url, location_status";

export function resetMockAccountDataStateForTests(state?: Partial<AccountDataState>) {
  resetSharedMockAccountDataStateForTests(state);
}

export async function loadAccountDataSnapshot(account: CurrentUser): Promise<AccountDataSnapshot> {
  if (getBackendStatus().mode !== "supabase") {
    return loadMockAccountDataSnapshot(account, mockAccountState);
  }

  return loadSupabaseAccountDataSnapshot(account);
}

export async function loadAdminAccountDataState(): Promise<AccountDataState> {
  if (getBackendStatus().mode !== "supabase") {
    return {
      users: [...mockAccountState.users],
      pets: withMaterialCounts(mockAccountState.pets, mockAccountState.assets),
      assets: [...mockAccountState.assets],
      generationJobs: [...mockAccountState.generationJobs],
      friends: [...mockAccountState.friends],
      hostingRequests: [...mockAccountState.hostingRequests],
      referralCodes: [...mockAccountState.referralCodes],
      userReferrals: [...mockAccountState.userReferrals],
      referralRewardLedger: [...mockAccountState.referralRewardLedger],
      rechargeRecords: [...mockAccountState.rechargeRecords]
    };
  }

  return loadSupabaseAdminAccountDataState();
}

export async function deleteAccountPet(
  account: CurrentUser,
  petId: string
): Promise<PetDeleteResult> {
  if (getBackendStatus().mode !== "supabase") {
    return deletePetFromState(mockAccountState, account, petId);
  }

  return deleteSupabasePet(account, petId);
}

export async function createAccountPet(input: {
  account: CurrentUser;
  name?: string;
}): Promise<Pet> {
  if (getBackendStatus().mode !== "supabase") {
    return createPetInState(mockAccountState, input.account, { name: input.name });
  }

  return createSupabasePet(input);
}

export async function updateAccountPetName(input: {
  account: CurrentUser;
  petId: string;
  name: string;
}): Promise<Pet> {
  if (getBackendStatus().mode !== "supabase") {
    return updatePetNameInState(mockAccountState, input.account, {
      petId: input.petId,
      name: input.name
    });
  }

  return updateSupabasePetName(input);
}

export async function assertAccountPetEditable(input: {
  account: CurrentUser;
  petId: string;
}): Promise<void> {
  if (getBackendStatus().mode !== "supabase") {
    const pet = mockAccountState.pets.find(
      (item) => item.id === input.petId && item.ownerUserId === input.account.id
    );

    if (!pet) {
      throw new Error("PET_NOT_FOUND");
    }

    if (isReadonlyPet(pet)) {
      throw new Error("PET_READONLY");
    }

    return;
  }

  await fetchEditableSupabasePetRow(input.account, input.petId);
}

export async function updateAccountProfile(input: {
  account: CurrentUser;
  name: string;
}): Promise<CurrentUser> {
  if (getBackendStatus().mode !== "supabase") {
    return updateUserProfileInState(mockAccountState, input.account, { name: input.name });
  }

  return updateSupabaseProfile(input);
}

export async function adjustAdminUserCredits(input: {
  userId: string;
  amount: number;
  reason: string;
}): Promise<AdminCreditAdjustmentResult> {
  if (getBackendStatus().mode !== "supabase") {
    return adjustUserCreditsInState(mockAccountState, input);
  }

  return adjustSupabaseUserCredits(input);
}

export async function deleteAdminUser(userId: string): Promise<AdminUserDeleteResult> {
  if (getBackendStatus().mode !== "supabase") {
    return deleteUserFromState(mockAccountState, userId);
  }

  return deleteSupabaseUser(userId);
}

export async function listAccountFriends(account: CurrentUser): Promise<Friend[]> {
  if (getBackendStatus().mode !== "supabase") {
    return [...mockAccountState.friends];
  }

  return fetchFriends(account.id);
}

export async function addAccountFriend(input: {
  account: CurrentUser;
  email: string;
}): Promise<Friend> {
  if (getBackendStatus().mode !== "supabase") {
    return addFriendToState(mockAccountState, input.account, input.email);
  }

  return addSupabaseFriend(input);
}

export async function removeAccountFriend(input: {
  account: CurrentUser;
  friendId: string;
}): Promise<FriendDeleteResult> {
  if (getBackendStatus().mode !== "supabase") {
    return removeFriendFromState(mockAccountState, input.friendId);
  }

  return removeSupabaseFriend(input);
}

export async function createAccountHostingRequest(input: {
  account: CurrentUser;
  petId: string;
  toUserId: string;
}): Promise<HostingRequest> {
  if (getBackendStatus().mode !== "supabase") {
    return createHostingRequestInState(mockAccountState, input.account, {
      petId: input.petId,
      toUserId: input.toUserId
    });
  }

  return createSupabaseHostingRequest(input);
}

export async function updateAccountHostingRequest(input: {
  account: CurrentUser;
  requestId: string;
  action: HostingRequestAction;
}): Promise<HostingRequest> {
  if (getBackendStatus().mode !== "supabase") {
    return updateHostingRequestInState(mockAccountState, input.account, {
      requestId: input.requestId,
      action: input.action
    });
  }

  return updateSupabaseHostingRequest(input);
}

export async function recallAccountPet(input: {
  account: CurrentUser;
  petId: string;
}): Promise<{ petId: string; status: string }> {
  if (getBackendStatus().mode !== "supabase") {
    const pet = mockAccountState.pets.find(
      (item) => item.id === input.petId && item.ownerUserId === input.account.id
    );

    if (!pet) {
      throw new Error("PET_NOT_FOUND");
    }

    pet.currentHostUserId = input.account.id;
    pet.locationStatus = "at_owner_desktop";
    pet.host = "me";
    pet.ownership = "owned";
    pet.status = "在我的桌面";
    return { petId: pet.id, status: "已召回到我的桌面" };
  }

  return recallSupabasePet(input);
}

export async function saveAccountPetImages(input: {
  account: CurrentUser;
  petId: string;
  imageUrl: string;
}): Promise<Pet> {
  if (getBackendStatus().mode !== "supabase") {
    return updatePetImagesInState(mockAccountState, input.account, {
      petId: input.petId,
      imageUrl: input.imageUrl
    });
  }

  return updateSupabasePetImages(input);
}

export async function saveAccountPetAsset(input: {
  account: CurrentUser;
  petId: string;
  slot: string;
  videoUrl: string;
}): Promise<PetAsset> {
  if (getBackendStatus().mode !== "supabase") {
    return upsertPetAssetInState(mockAccountState, input.account, {
      petId: input.petId,
      slot: input.slot,
      videoUrl: input.videoUrl
    });
  }

  return upsertSupabasePetAsset(input);
}

export async function createAccountGenerationJob(input: {
  account: CurrentUser;
  job: GenerationJob;
  provider: string;
}): Promise<GenerationJob> {
  if (getBackendStatus().mode !== "supabase") {
    return createGenerationJobInState(mockAccountState, input.account, input.job);
  }

  return createSupabaseGenerationJob(input);
}

export async function findActiveAccountGenerationJob(input: {
  account: CurrentUser;
  petId: string;
  slot?: string;
  type?: GenerationJob["type"];
}): Promise<GenerationJob | null> {
  if (getBackendStatus().mode !== "supabase") {
    expireStaleGenerationJobsInState(mockAccountState, input.account, {
      timeoutMs: generationJobTimeoutMs()
    });

    return findActiveGenerationJobInState(mockAccountState, input.account, input);
  }

  const row = await findActiveSupabaseGenerationJobRow(input.account, input);

  if (!row) {
    return null;
  }

  const syncedJob = await syncAccountGenerationJobStatus(
    input.account,
    row.provider_job_id ?? row.id
  );

  return syncedJob && (isActiveGenerationJob(syncedJob) || syncedJob.status === "succeeded")
    ? syncedJob
    : null;
}

export async function listAccountGenerationJobs(account: CurrentUser): Promise<GenerationJob[]> {
  if (getBackendStatus().mode !== "supabase") {
    return [...mockAccountState.generationJobs]
      .filter((job) => mockAccountState.pets.some((pet) => pet.id === job.petId && canAccountSeePet(account, pet)))
      .sort(sortJobsNewestFirst);
  }

  return fetchSupabaseGenerationJobs(account);
}

export async function refreshAccountGenerationJobs(account: CurrentUser): Promise<GenerationJob[]> {
  const jobs = await listAccountGenerationJobs(account);
  const jobsToSync = jobs.filter(
    (job) => isActiveGenerationJob(job) || isRecoverableExpiredProviderJob(job)
  );

  await Promise.allSettled(jobsToSync.map((job) => syncAccountGenerationJobStatus(account, job.jobId)));

  return listAccountGenerationJobs(account);
}

export async function syncAccountGenerationJobStatus(
  account: CurrentUser,
  jobId: string
): Promise<GenerationJob | null> {
  const storedJob = await findAccountGenerationJob(account, jobId);

  if (!storedJob) {
    return null;
  }

  const shouldCheckProvider =
    isActiveGenerationJob(storedJob) ||
    (storedJob.status === "expired" && isJimengJobId(storedJob.jobId));

  if (!shouldCheckProvider) {
    return storedJob;
  }

  let providerJob: GenerationJob | null = null;

  if (isJimengJobId(storedJob.jobId)) {
    try {
      providerJob = await getJimengVideoJob(storedJob.jobId);
    } catch (error: unknown) {
      if (isStaleGenerationJob(storedJob)) {
        return saveExpiredGenerationJob(account, storedJob);
      }

      throw error;
    }
  }

  if (!providerJob) {
    if (!isActiveGenerationJob(storedJob)) {
      return storedJob;
    }

    if (isStaleGenerationJob(storedJob)) {
      return saveExpiredGenerationJob(account, storedJob);
    }

    return storedJob;
  }

  const mergedJob = mergeStoredAndProviderJob(storedJob, providerJob);

  if (!isActiveGenerationJob(storedJob) && mergedJob.status !== "succeeded") {
    return storedJob;
  }

  if (isStaleGenerationJob(mergedJob)) {
    return saveExpiredGenerationJob(account, mergedJob);
  }

  if (getBackendStatus().mode !== "supabase") {
    return updateGenerationJobInState(mockAccountState, account, mergedJob);
  }

  return updateSupabaseGenerationJob(account, mergedJob);
}

async function expireStaleAccountGenerationJobs(account: CurrentUser): Promise<GenerationJob[]> {
  if (getBackendStatus().mode !== "supabase") {
    return expireStaleGenerationJobsInState(mockAccountState, account, {
      timeoutMs: generationJobTimeoutMs()
    });
  }

  const rows = await expireStaleSupabaseGenerationJobs(account);

  return rows.map(mapGenerationJobRow);
}

function generationJobTimeoutMs() {
  const value = process.env.GENERATION_JOB_TIMEOUT_SECONDS ?? process.env.JIMENG_VIDEO_JOB_TIMEOUT_SECONDS;
  const seconds = value ? Number(value) : NaN;

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return defaultGenerationJobTimeoutMs;
  }

  return seconds * 1000;
}

function generationJobRecoveryWindowMs() {
  const value = process.env.GENERATION_JOB_RECOVERY_WINDOW_SECONDS;
  const seconds = value ? Number(value) : NaN;

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 24 * 60 * 60 * 1000;
  }

  return seconds * 1000;
}

function isStaleGenerationJob(job: GenerationJob, now: Date = new Date()) {
  if (!isActiveGenerationJob(job)) {
    return false;
  }

  const startedAt = job.createdAt ? Date.parse(job.createdAt) : NaN;
  const nowMs = now.getTime();

  return Number.isFinite(startedAt) &&
    Number.isFinite(nowMs) &&
    nowMs - startedAt >= generationJobTimeoutMs();
}

function isRecoverableExpiredProviderJob(job: GenerationJob, now: Date = new Date()) {
  if (job.status !== "expired" || !isJimengJobId(job.jobId)) {
    return false;
  }

  const createdAtMs = job.createdAt ? Date.parse(job.createdAt) : NaN;
  const nowMs = now.getTime();

  return Number.isFinite(createdAtMs) &&
    Number.isFinite(nowMs) &&
    nowMs - createdAtMs <= generationJobRecoveryWindowMs();
}

async function saveExpiredGenerationJob(
  account: CurrentUser,
  job: GenerationJob
): Promise<GenerationJob> {
  const expiredJob: GenerationJob = {
    ...job,
    status: "expired",
    progress: 100,
    message: staleGenerationJobMessage
  };

  if (getBackendStatus().mode !== "supabase") {
    return updateGenerationJobInState(mockAccountState, account, expiredJob);
  }

  return updateSupabaseGenerationJob(account, expiredJob);
}

async function loadSupabaseAccountDataSnapshot(account: CurrentUser): Promise<AccountDataSnapshot> {
  const supabase = getRequiredSupabaseAdminClient();
  const [profile, balance, petRows] = await Promise.all([
    fetchProfile(account.id),
    fetchCreditBalance(account.id),
    supabase
      .from("pets")
      .select(petSelectColumns)
      .or(`owner_user_id.eq.${account.id},current_host_user_id.eq.${account.id}`)
      .then(unwrapSupabaseData<PetRow[]>)
  ]);
  const mappedUser = mapUser(account, profile, balance);
  const petIds = petRows.map((pet) => pet.id);
  const assets = petIds.length > 0 ? await fetchPetAssets(petIds) : [];
  const mappedPets = sortPetsForAccount(withMaterialCounts(
    petRows.map((pet) => mapPetRow(pet, account.id)),
    assets
  ));

  return {
    user: mappedUser,
    users: [mappedUser],
    pets: mappedPets,
    assets,
    generationJobs: await fetchSupabaseGenerationJobs(mappedUser),
    friends: await fetchFriends(account.id),
    hostingRequests: await fetchHostingRequests(account.id),
    referralCodes: [],
    userReferrals: [],
    referralRewardLedger: [],
    rechargeRecords: []
  };
}

async function loadSupabaseAdminAccountDataState(): Promise<AccountDataState> {
  const supabase = getRequiredSupabaseAdminClient();
  const [profileRows, balanceRows, petRows] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name")
      .then(unwrapSupabaseData<ProfileRow[]>),
    supabase
      .from("credit_balances")
      .select("user_id, balance")
      .then(unwrapSupabaseData<CreditBalanceRow[]>),
    supabase
      .from("pets")
      .select(petSelectColumns)
      .then(unwrapSupabaseData<PetRow[]>)
  ]);
  const balances = new Map(balanceRows.map((row) => [row.user_id, row.balance ?? 0]));
  const users = profileRows.map((profile) =>
    mapUser(
      {
        id: profile.id,
        name: profile.display_name ?? profile.email ?? profile.id,
        email: profile.email ?? `${profile.id}@unknown.local`,
        credits: balances.get(profile.id) ?? 0
      },
      profile,
      balances.get(profile.id) ?? 0
    )
  );
  const petIds = petRows.map((pet) => pet.id);
  const assets = petIds.length > 0 ? await fetchPetAssets(petIds) : [];

  return {
    users,
    pets: sortPetsForAccount(withMaterialCounts(
      petRows.map((pet) => mapPetRow(pet)),
      assets
    )),
    assets,
    generationJobs: [],
    friends: [],
    hostingRequests: [],
    referralCodes: [],
    userReferrals: [],
    referralRewardLedger: [],
    rechargeRecords: []
  };
}

async function deleteSupabasePet(
  account: CurrentUser,
  petId: string
): Promise<PetDeleteResult> {
  const supabase = getRequiredSupabaseAdminClient();
  const pet = await supabase
    .from("pets")
    .select("id, owner_user_id")
    .eq("id", petId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<{ id: string; owner_user_id: string }>);

  if (!pet || pet.owner_user_id !== account.id) {
    throw new Error("PET_NOT_FOUND");
  }

  const deletedAssets = await supabase
    .from("pet_assets")
    .delete({ count: "exact" })
    .eq("pet_id", petId)
    .then((result) => {
      if (result.error) {
        throw result.error;
      }

      return result.count ?? 0;
    });

  await supabase
    .from("pets")
    .delete()
    .eq("id", petId)
    .then(unwrapSupabaseData<unknown>);

  return {
    deletedPetId: petId,
    deletedAssets
  };
}

async function createSupabasePet(input: {
  account: CurrentUser;
  name?: string;
}): Promise<Pet> {
  const supabase = getRequiredSupabaseAdminClient();
  const [allPetRows, ownedPetRows] = await Promise.all([
    supabase
      .from("pets")
      .select("pet_number")
      .then(unwrapSupabaseData<Array<{ pet_number: string }>>),
    supabase
      .from("pets")
      .select("id, asset_bundle_url")
      .eq("owner_user_id", input.account.id)
      .then(unwrapSupabaseData<Array<{ id: string; asset_bundle_url: string | null }>>)
  ]);
  const editablePetCount = ownedPetRows.filter(
    (pet) => pet.asset_bundle_url !== starterPetAssetBundleUrl
  ).length;
  const name = cleanSupabasePetName(input.name) ?? `猫咪 ${editablePetCount + 1}`;
  const inserted = await supabase
    .from("pets")
    .insert({
      pet_number: nextPetNumber(allPetRows.map((row) => ({ petNumber: row.pet_number }))),
      owner_user_id: input.account.id,
      current_host_user_id: input.account.id,
      name,
      species: "cat",
      location_status: "at_owner_desktop",
      updated_at: new Date().toISOString()
    })
    .select(petSelectColumns)
    .single()
    .then(unwrapSupabaseData<PetRow>);

  return mapPetRow(inserted, input.account.id);
}

async function updateSupabasePetImages(input: {
  account: CurrentUser;
  petId: string;
  imageUrl: string;
}): Promise<Pet> {
  await fetchEditableSupabasePetRow(input.account, input.petId);

  const supabase = getRequiredSupabaseAdminClient();
  const pet = await supabase
    .from("pets")
    .update({
      avatar_url: input.imageUrl,
      source_image_url: input.imageUrl,
      front_image_url: input.imageUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.petId)
    .eq("owner_user_id", input.account.id)
    .select(petSelectColumns)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<PetRow>);

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  await retireActiveSupabaseActionJobsForPet(input.account, input.petId);

  return mapPetRow(pet, input.account.id);
}

async function updateSupabasePetName(input: {
  account: CurrentUser;
  petId: string;
  name: string;
}): Promise<Pet> {
  const name = cleanSupabasePetName(input.name);

  if (!name) {
    throw new Error("PET_NAME_REQUIRED");
  }

  await fetchEditableSupabasePetRow(input.account, input.petId);

  const supabase = getRequiredSupabaseAdminClient();
  const pet = await supabase
    .from("pets")
    .update({
      name,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.petId)
    .eq("owner_user_id", input.account.id)
    .select(petSelectColumns)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<PetRow>);

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  return mapPetRow(pet, input.account.id);
}

async function updateSupabaseProfile(input: {
  account: CurrentUser;
  name: string;
}): Promise<CurrentUser> {
  const name = cleanSupabaseDisplayName(input.name);

  if (!name) {
    throw new Error("DISPLAY_NAME_REQUIRED");
  }

  const supabase = getRequiredSupabaseAdminClient();
  const profile = await supabase
    .from("profiles")
    .update({
      display_name: name
    })
    .eq("id", input.account.id)
    .select("id, email, display_name, account_status")
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<ProfileRow>);

  if (!profile) {
    throw new Error("USER_NOT_FOUND");
  }

  try {
    await supabase.auth.admin.updateUserById(input.account.id, {
      user_metadata: {
        display_name: name
      }
    });
  } catch {
    // The profile table is the source of truth for the web app; auth metadata sync is best effort.
  }

  return mapUser(input.account, profile, input.account.credits);
}

async function adjustSupabaseUserCredits(input: {
  userId: string;
  amount: number;
  reason: string;
}): Promise<AdminCreditAdjustmentResult> {
  const profile = await fetchProfile(input.userId);

  if (!profile) {
    throw new Error("USER_NOT_FOUND");
  }

  const balance = await fetchCreditBalance(input.userId);
  const currentBalance = balance?.balance ?? 0;
  const adjustment = adjustUserCreditsInState(
    createMockAccountDataState({
      users: [
        {
          id: profile.id,
          name: profile.display_name ?? profile.email ?? profile.id,
          email: profile.email ?? `${profile.id}@unknown.local`,
          credits: currentBalance
        }
      ]
    }),
    input
  );
  const supabase = getRequiredSupabaseAdminClient();

  await supabase
    .from("credit_balances")
    .upsert(
      {
        user_id: input.userId,
        balance: adjustment.balance,
        updated_at: adjustment.adjustedAt
      },
      { onConflict: "user_id" }
    )
    .then(unwrapSupabaseData<unknown>);

  await supabase
    .from("credit_ledger")
    .insert({
      user_id: input.userId,
      amount: adjustment.amount,
      reason: `管理员调整：${adjustment.reason}`
    })
    .then(unwrapSupabaseData<unknown>);

  return adjustment;
}

async function deleteSupabaseUser(userId: string): Promise<AdminUserDeleteResult> {
  const supabase = getRequiredSupabaseAdminClient();
  const profile = await fetchProfile(userId);

  if (!profile) {
    throw new Error("USER_NOT_FOUND");
  }

  const ownedPetRows = await supabase
    .from("pets")
    .select("id")
    .eq("owner_user_id", userId)
    .then(unwrapSupabaseData<Array<{ id: string }>>);
  const ownedPetIds = ownedPetRows.map((pet) => pet.id);
  const assetRows = ownedPetIds.length > 0
    ? await supabase
        .from("pet_assets")
        .select("pet_id")
        .in("pet_id", ownedPetIds)
        .then(unwrapSupabaseData<Array<{ pet_id: string }>>)
    : [];
  const ownedReferralCodeRows = await loadOptionalSupabaseRows(
    () =>
      supabase
        .from("referral_codes")
        .select("id")
        .eq("owner_user_id", userId)
        .then(unwrapSupabaseData<Array<{ id: string }>>),
    []
  );
  const ownedReferralCodeIds = ownedReferralCodeRows.map((code) => code.id);

  await deleteOptionalSupabaseRows(() =>
    supabase
      .from("referral_reward_ledger")
      .delete()
      .or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`)
      .then(unwrapSupabaseData<unknown>)
  );

  if (ownedReferralCodeIds.length > 0) {
    await deleteOptionalSupabaseRows(() =>
      supabase
        .from("referral_reward_ledger")
        .delete()
        .in("referral_code_id", ownedReferralCodeIds)
        .then(unwrapSupabaseData<unknown>)
    );
  }

  await deleteOptionalSupabaseRows(() =>
    supabase
      .from("user_referrals")
      .delete()
      .or(`referred_user_id.eq.${userId},referrer_user_id.eq.${userId}`)
      .then(unwrapSupabaseData<unknown>)
  );

  if (ownedReferralCodeIds.length > 0) {
    await deleteOptionalSupabaseRows(() =>
      supabase
        .from("user_referrals")
        .delete()
        .in("referral_code_id", ownedReferralCodeIds)
        .then(unwrapSupabaseData<unknown>)
    );
  }

  await deleteOptionalSupabaseRows(() =>
    supabase
      .from("referral_codes")
      .delete()
      .eq("owner_user_id", userId)
      .then(unwrapSupabaseData<unknown>)
  );

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

  if (authDeleteError && !authDeleteError.message.toLowerCase().includes("not found")) {
    throw authDeleteError;
  }

  await supabase
    .from("profiles")
    .delete()
    .eq("id", userId)
    .then(unwrapSupabaseData<unknown>);

  return {
    deletedUserId: userId,
    deletedPets: ownedPetIds.length,
    deletedAssets: assetRows.length
  };
}

async function loadOptionalSupabaseRows<T>(operation: () => PromiseLike<T>, fallback: T) {
  try {
    return await operation();
  } catch (error) {
    if (isMissingSupabaseSchemaError(error)) {
      return fallback;
    }

    throw error;
  }
}

async function deleteOptionalSupabaseRows(operation: () => PromiseLike<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (isMissingSupabaseSchemaError(error)) {
      return;
    }

    throw error;
  }
}

function isMissingSupabaseSchemaError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("Could not find the table") ||
    message.includes("does not exist")
  );
}

async function createSupabaseGenerationJob(input: {
  account: CurrentUser;
  job: GenerationJob;
  provider: string;
}): Promise<GenerationJob> {
  const supabase = getRequiredSupabaseAdminClient();
  await fetchEditableSupabasePetRow(input.account, input.job.petId);

  const activeRow = await findActiveSupabaseGenerationJobRow(input.account, {
    petId: input.job.petId,
    slot: input.job.slot,
    type: input.job.type
  });

  if (activeRow) {
    const syncedJob = await syncAccountGenerationJobStatus(
      input.account,
      activeRow.provider_job_id ?? activeRow.id
    );

    if (syncedJob && (isActiveGenerationJob(syncedJob) || syncedJob.status === "succeeded")) {
      return syncedJob;
    }
  }

  if (input.job.type === "action_video" && input.job.slot) {
    const existingAsset = await findSupabasePetAssetRow(input.job.petId, input.job.slot);

    await supabase
      .from("pet_assets")
      .upsert(
        {
          pet_id: input.job.petId,
          slot: input.job.slot,
          status: existingAsset?.video_url ? "ready" : "generating",
          video_url: existingAsset?.video_url ?? null,
          provider: input.provider,
          provider_job_id: input.job.jobId,
          updated_at: new Date().toISOString()
        },
        { onConflict: "pet_id,slot" }
      )
      .then(unwrapSupabaseData<unknown>);
  }

  const insertedJob = await supabase
    .from("generation_jobs")
    .insert({
      user_id: input.account.id,
      pet_id: input.job.petId,
      job_type: input.job.type,
      slot: input.job.slot ?? null,
      status: input.job.status === "queued" ? "running" : input.job.status,
      cost: input.job.cost,
      provider: input.provider,
      provider_job_id: input.job.jobId,
      result_url: input.job.resultUrl ?? null,
      updated_at: new Date().toISOString()
    })
    .select(
      "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at"
    )
    .single()
    .then(unwrapSupabaseData<GenerationJobRow>);

  await applyGenerationCreditDebit({
    account: input.account,
    jobId: insertedJob.id,
    cost: input.job.cost,
    reason: input.job.slot ? `生成素材 ${input.job.slot}` : "生成素材"
  });

  return mapGenerationJobRow(insertedJob);
}

async function updateSupabaseGenerationJob(
  account: CurrentUser,
  job: GenerationJob
): Promise<GenerationJob> {
  const supabase = getRequiredSupabaseAdminClient();
  const row = await findSupabaseGenerationJobRow(account, job.jobId);

  if (!row) {
    throw new Error("GENERATION_JOB_NOT_FOUND");
  }

  const status = job.status === "queued" ? "running" : job.status;
  const updatedRow = await supabase
    .from("generation_jobs")
    .update({
      status,
      result_url: job.resultUrl ?? row.result_url,
      error_message: job.message ?? row.error_message,
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id)
    .eq("user_id", account.id)
    .select(
      "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at"
    )
    .single()
    .then(unwrapSupabaseData<GenerationJobRow>);

  if (updatedRow.job_type === "action_video" && updatedRow.pet_id && updatedRow.slot) {
    const existingAsset = await findSupabasePetAssetRow(updatedRow.pet_id, updatedRow.slot);
    const existingVideoUrl = existingAsset?.video_url ?? null;
    const newVideoUrl = status === "succeeded" ? updatedRow.result_url : null;
    const terminalStatus =
      status === "succeeded" || status === "failed" || status === "expired";
    const assetStatus = newVideoUrl
      ? "ready"
      : terminalStatus && existingVideoUrl
        ? "ready"
        : terminalStatus
          ? "failed"
          : existingVideoUrl
            ? "ready"
            : "generating";
    const videoUrl = newVideoUrl ?? existingVideoUrl;

    await supabase
      .from("pet_assets")
      .upsert(
        {
          pet_id: updatedRow.pet_id,
          slot: updatedRow.slot,
          status: assetStatus,
          video_url: videoUrl,
          provider: updatedRow.provider,
          provider_job_id: updatedRow.provider_job_id,
          updated_at: new Date().toISOString()
        },
        { onConflict: "pet_id,slot" }
      )
      .then(unwrapSupabaseData<unknown>);
  }

  if (isRefundableGenerationStatus(status)) {
    await refundSupabaseGenerationCredits(account, [updatedRow]);
  }

  return mapGenerationJobRow(updatedRow);
}

async function upsertSupabasePetAsset(input: {
  account: CurrentUser;
  petId: string;
  slot: string;
  videoUrl: string;
}): Promise<PetAsset> {
  const supabase = getRequiredSupabaseAdminClient();
  const pet = await supabase
    .from("pets")
    .select(petSelectColumns)
    .eq("id", input.petId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<PetRow>);

  if (!pet || pet.owner_user_id !== input.account.id) {
    throw new Error("PET_NOT_FOUND");
  }

  if (pet.asset_bundle_url === starterPetAssetBundleUrl) {
    throw new Error("PET_READONLY");
  }

  const asset = await supabase
    .from("pet_assets")
    .upsert(
      {
        pet_id: input.petId,
        slot: input.slot,
        status: "ready",
        video_url: input.videoUrl,
        updated_at: new Date().toISOString()
      },
      { onConflict: "pet_id,slot" }
    )
    .select("pet_id, slot, status, video_url")
    .single()
    .then(unwrapSupabaseData<PetAssetRow>);

  return mapPetAssetRow(asset);
}

async function addSupabaseFriend(input: {
  account: CurrentUser;
  email: string;
}): Promise<Friend> {
  const supabase = getRequiredSupabaseAdminClient();
  const email = cleanSupabaseEmail(input.email);

  if (!email) {
    throw new Error("FRIEND_EMAIL_REQUIRED");
  }

  const profile = await supabase
    .from("profiles")
    .select("id, email, display_name, account_status")
    .ilike("email", email)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<ProfileRow>);

  if (!profile || profile.id === input.account.id) {
    throw new Error("FRIEND_NOT_FOUND");
  }

  const [userAId, userBId] = orderedFriendIds(input.account.id, profile.id);

  await supabase
    .from("friendships")
    .upsert(
      {
        user_a_id: userAId,
        user_b_id: userBId
      },
      { onConflict: "user_a_id,user_b_id" }
    )
    .then(unwrapSupabaseData<unknown>);

  return mapFriendProfile(profile, await hostedPetCount(input.account.id, profile.id));
}

async function removeSupabaseFriend(input: {
  account: CurrentUser;
  friendId: string;
}): Promise<FriendDeleteResult> {
  const [userAId, userBId] = orderedFriendIds(input.account.id, input.friendId);
  const result = await getRequiredSupabaseAdminClient()
    .from("friendships")
    .delete({ count: "exact" })
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId);

  if (result.error) {
    throw result.error;
  }

  if ((result.count ?? 0) === 0) {
    throw new Error("FRIEND_NOT_FOUND");
  }

  return {
    deletedFriendId: input.friendId
  };
}

async function createSupabaseHostingRequest(input: {
  account: CurrentUser;
  petId: string;
  toUserId: string;
}): Promise<HostingRequest> {
  const supabase = getRequiredSupabaseAdminClient();
  const [userAId, userBId] = orderedFriendIds(input.account.id, input.toUserId);
  const [pet, friendship, friendProfile] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, owner_user_id, current_host_user_id")
      .eq("id", input.petId)
      .maybeSingle()
      .then(unwrapSupabaseMaybeData<{
        id: string;
        name: string;
        owner_user_id: string;
        current_host_user_id: string | null;
      }>),
    supabase
      .from("friendships")
      .select("user_a_id, user_b_id")
      .eq("user_a_id", userAId)
      .eq("user_b_id", userBId)
      .maybeSingle()
      .then(unwrapSupabaseMaybeData<FriendshipRow>),
    supabase
      .from("profiles")
      .select("id, email, display_name, account_status")
      .eq("id", input.toUserId)
      .maybeSingle()
      .then(unwrapSupabaseMaybeData<ProfileRow>)
  ]);

  if (
    !pet ||
    pet.owner_user_id !== input.account.id ||
    pet.current_host_user_id !== input.account.id ||
    !friendship ||
    !friendProfile
  ) {
    throw new Error("HOSTING_TARGET_NOT_FOUND");
  }

  const row = await supabase
    .from("pet_hosting_requests")
    .insert({
      pet_id: input.petId,
      from_user_id: input.account.id,
      to_user_id: input.toUserId,
      status: "pending",
      updated_at: new Date().toISOString()
    })
    .select("id, pet_id, from_user_id, to_user_id, status, updated_at")
    .single()
    .then(unwrapSupabaseData<HostingRequestRow>);

  return {
    id: row.id,
    petId: row.pet_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    petName: pet.name,
    from: input.account.name,
    status: `等待 ${friendProfile.display_name ?? friendProfile.email ?? "好友"} 接收`,
    statusCode: "pending"
  };
}

async function updateSupabaseHostingRequest(input: {
  account: CurrentUser;
  requestId: string;
  action: HostingRequestAction;
}): Promise<HostingRequest> {
  const supabase = getRequiredSupabaseAdminClient();
  const row = await supabase
    .from("pet_hosting_requests")
    .select("id, pet_id, from_user_id, to_user_id, status, updated_at")
    .eq("id", input.requestId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<HostingRequestRow>);

  if (!row || (row.from_user_id !== input.account.id && row.to_user_id !== input.account.id)) {
    throw new Error("HOSTING_REQUEST_NOT_FOUND");
  }

  const nextStatus = hostingRequestStatusForAction(input.action);

  if (input.action === "accept" || input.action === "decline") {
    if (row.to_user_id !== input.account.id || row.status !== "pending") {
      throw new Error("HOSTING_REQUEST_NOT_FOUND");
    }
  } else if (row.to_user_id !== input.account.id || row.status !== "accepted") {
    throw new Error("HOSTING_REQUEST_NOT_FOUND");
  }

  if (input.action === "accept") {
    await supabase
      .from("pets")
      .update({
        current_host_user_id: row.to_user_id,
        location_status: "hosted_by_friend",
        updated_at: new Date().toISOString()
      })
      .eq("id", row.pet_id)
      .eq("owner_user_id", row.from_user_id)
      .then(unwrapSupabaseMutation);
  } else if (input.action === "return") {
    await supabase
      .from("pets")
      .update({
        current_host_user_id: row.from_user_id,
        location_status: "at_owner_desktop",
        updated_at: new Date().toISOString()
      })
      .eq("id", row.pet_id)
      .eq("current_host_user_id", row.to_user_id)
      .then(unwrapSupabaseMutation);
  }

  const updatedRow = await supabase
    .from("pet_hosting_requests")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id)
    .select("id, pet_id, from_user_id, to_user_id, status, updated_at")
    .single()
    .then(unwrapSupabaseData<HostingRequestRow>);

  return mapHostingRequestRowForViewer(updatedRow, input.account.id, await fetchHostingRequestDisplayData([updatedRow]));
}

async function recallSupabasePet(input: {
  account: CurrentUser;
  petId: string;
}): Promise<{ petId: string; status: string }> {
  const pet = await getRequiredSupabaseAdminClient()
    .from("pets")
    .update({
      current_host_user_id: input.account.id,
      location_status: "at_owner_desktop",
      updated_at: new Date().toISOString()
    })
    .eq("id", input.petId)
    .eq("owner_user_id", input.account.id)
    .select("id")
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<{ id: string }>);

  if (!pet) {
    throw new Error("PET_NOT_FOUND");
  }

  return {
    petId: pet.id,
    status: "已召回到我的桌面"
  };
}

async function fetchEditableSupabasePetRow(
  account: CurrentUser,
  petId: string
): Promise<PetRow> {
  const pet = await getRequiredSupabaseAdminClient()
    .from("pets")
    .select(petSelectColumns)
    .eq("id", petId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<PetRow>);

  if (!pet || pet.owner_user_id !== account.id) {
    throw new Error("PET_NOT_FOUND");
  }

  if (pet.asset_bundle_url === starterPetAssetBundleUrl) {
    throw new Error("PET_READONLY");
  }

  return pet;
}

async function fetchProfile(userId: string) {
  return getRequiredSupabaseAdminClient()
    .from("profiles")
    .select("id, email, display_name, account_status")
    .eq("id", userId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<ProfileRow>);
}

async function fetchCreditBalance(userId: string) {
  return getRequiredSupabaseAdminClient()
    .from("credit_balances")
    .select("user_id, balance")
    .eq("user_id", userId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<CreditBalanceRow>);
}

async function fetchPetAssets(petIds: string[]) {
  const rows = await getRequiredSupabaseAdminClient()
    .from("pet_assets")
    .select("pet_id, slot, status, video_url")
    .in("pet_id", petIds)
    .then(unwrapSupabaseData<PetAssetRow[]>);

  return normalizePetAssets(rows.map(mapPetAssetRow));
}

async function fetchSupabaseGenerationJobs(account: CurrentUser): Promise<GenerationJob[]> {
  const rows = await getRequiredSupabaseAdminClient()
    .from("generation_jobs")
    .select(
      "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at"
    )
    .eq("user_id", account.id)
    .order("created_at", { ascending: false })
    .limit(30)
    .then(unwrapSupabaseData<GenerationJobRow[]>);

  return rows.map(mapGenerationJobRow);
}

async function findAccountGenerationJob(
  account: CurrentUser,
  jobId: string
): Promise<GenerationJob | null> {
  if (getBackendStatus().mode !== "supabase") {
    return mockAccountState.generationJobs.find((job) => job.jobId === jobId) ?? null;
  }

  const row = await findSupabaseGenerationJobRow(account, jobId);

  return row ? mapGenerationJobRow(row) : null;
}

async function findSupabaseGenerationJobRow(
  account: CurrentUser,
  jobId: string
): Promise<GenerationJobRow | null> {
  const supabase = getRequiredSupabaseAdminClient();
  const selectColumns =
    "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at";
  const byProviderId = await supabase
    .from("generation_jobs")
    .select(selectColumns)
    .eq("user_id", account.id)
    .eq("provider_job_id", jobId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<GenerationJobRow>);

  if (byProviderId) {
    return byProviderId;
  }

  if (!isUuid(jobId)) {
    return null;
  }

  return supabase
    .from("generation_jobs")
    .select(selectColumns)
    .eq("user_id", account.id)
    .eq("id", jobId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<GenerationJobRow>);
}

async function findSupabasePetAssetRow(
  petId: string,
  slot: string
): Promise<PetAssetRow | null> {
  return getRequiredSupabaseAdminClient()
    .from("pet_assets")
    .select("pet_id, slot, status, video_url")
    .eq("pet_id", petId)
    .eq("slot", slot)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<PetAssetRow>);
}

async function retireActiveSupabaseActionJobsForPet(account: CurrentUser, petId: string) {
  const supabase = getRequiredSupabaseAdminClient();
  const activeRows = await supabase
    .from("generation_jobs")
    .select("id, pet_id, slot")
    .eq("user_id", account.id)
    .eq("pet_id", petId)
    .eq("job_type", "action_video")
    .in("status", ["queued", "running"])
    .then(unwrapSupabaseData<Array<Pick<GenerationJobRow, "id" | "pet_id" | "slot">>>);

  if (activeRows.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const jobIds = activeRows.map((row) => row.id);
  const slots = [...new Set(activeRows.map((row) => row.slot).filter((slot): slot is string => Boolean(slot)))];
  const selectColumns =
    "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at";

  const updatedRows = await supabase
    .from("generation_jobs")
    .update({
      status: "expired",
      error_message: "源图已更新，本次任务已作废。",
      updated_at: now
    })
    .eq("user_id", account.id)
    .in("id", jobIds)
    .select(selectColumns)
    .then(unwrapSupabaseData<GenerationJobRow[]>);

  await refundSupabaseGenerationCredits(account, updatedRows);

  if (slots.length === 0) {
    return;
  }

  await supabase
    .from("pet_assets")
    .update({
      status: "failed",
      updated_at: now
    })
    .eq("pet_id", petId)
    .in("slot", slots)
    .is("video_url", null)
    .then(unwrapSupabaseData<unknown>);
}

async function expireStaleSupabaseGenerationJobs(account: CurrentUser): Promise<GenerationJobRow[]> {
  const supabase = getRequiredSupabaseAdminClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - generationJobTimeoutMs()).toISOString();
  const selectColumns =
    "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at";
  const staleRows = await supabase
    .from("generation_jobs")
    .select(selectColumns)
    .eq("user_id", account.id)
    .in("status", ["queued", "running"])
    .lt("created_at", cutoff)
    .then(unwrapSupabaseData<GenerationJobRow[]>);

  if (staleRows.length === 0) {
    return [];
  }

  const nowIso = now.toISOString();
  const staleJobIds = staleRows.map((row) => row.id);
  const updatedRows = await supabase
    .from("generation_jobs")
    .update({
      status: "expired",
      error_message: staleGenerationJobMessage,
      updated_at: nowIso
    })
    .eq("user_id", account.id)
    .in("id", staleJobIds)
    .select(selectColumns)
    .then(unwrapSupabaseData<GenerationJobRow[]>);
  const slotsByPetId = new Map<string, string[]>();

  staleRows.forEach((row) => {
    if (row.job_type !== "action_video" || !row.pet_id || !row.slot) {
      return;
    }

    slotsByPetId.set(row.pet_id, [...(slotsByPetId.get(row.pet_id) ?? []), row.slot]);
  });

  await Promise.all(
    [...slotsByPetId.entries()].map(([petId, slots]) =>
      supabase
        .from("pet_assets")
        .update({
          status: "failed",
          updated_at: nowIso
        })
        .eq("pet_id", petId)
        .in("slot", [...new Set(slots)])
        .is("video_url", null)
        .then(unwrapSupabaseData<unknown>)
    )
  );

  await refundSupabaseGenerationCredits(account, updatedRows);

  return updatedRows;
}

async function findActiveSupabaseGenerationJobRow(
  account: CurrentUser,
  input: {
    petId: string;
    slot?: string;
    type?: GenerationJob["type"];
  }
): Promise<GenerationJobRow | null> {
  const selectColumns =
    "id, user_id, pet_id, job_type, slot, status, cost, provider, provider_job_id, result_url, error_message, created_at, updated_at";
  let query = getRequiredSupabaseAdminClient()
    .from("generation_jobs")
    .select(selectColumns)
    .eq("user_id", account.id)
    .eq("pet_id", input.petId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.type) {
    query = query.eq("job_type", input.type);
  }

  query = input.slot ? query.eq("slot", input.slot) : query.is("slot", null);

  const rows = await query.then(unwrapSupabaseData<GenerationJobRow[]>);

  return rows[0] ?? null;
}

async function applyGenerationCreditDebit(input: {
  account: CurrentUser;
  jobId: string;
  cost: number;
  reason: string;
}) {
  if (input.cost <= 0) {
    return;
  }

  const supabase = getRequiredSupabaseAdminClient();
  const balance = await fetchCreditBalance(input.account.id);
  const nextBalance = Math.max((balance?.balance ?? input.account.credits) - input.cost, 0);

  await supabase
    .from("credit_balances")
    .upsert(
      {
        user_id: input.account.id,
        balance: nextBalance,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .then(unwrapSupabaseData<unknown>);

  await supabase
    .from("credit_ledger")
    .insert({
      user_id: input.account.id,
      job_id: input.jobId,
      amount: -input.cost,
      reason: input.reason
    })
    .then(unwrapSupabaseData<unknown>);
}

async function refundSupabaseGenerationCredits(
  account: CurrentUser,
  jobs: GenerationJobRow[]
) {
  for (const job of jobs) {
    if (!isRefundableGenerationStatus(job.status) || (job.cost ?? 0) <= 0) {
      continue;
    }

    const refundAmount = await refundableSupabaseCreditAmount(job);

    if (refundAmount <= 0) {
      continue;
    }

    const balance = await fetchCreditBalance(account.id);
    const nextBalance = (balance?.balance ?? account.credits) + refundAmount;
    const now = new Date().toISOString();
    const reason = job.slot ? `生成失败返还 ${job.slot}` : "生成失败返还";
    const supabase = getRequiredSupabaseAdminClient();

    await supabase
      .from("credit_balances")
      .upsert(
        {
          user_id: account.id,
          balance: nextBalance,
          updated_at: now
        },
        { onConflict: "user_id" }
      )
      .then(unwrapSupabaseData<unknown>);

    await supabase
      .from("credit_ledger")
      .insert({
        user_id: account.id,
        job_id: job.id,
        amount: refundAmount,
        reason
      })
      .then(unwrapSupabaseData<unknown>);
  }
}

async function refundableSupabaseCreditAmount(job: GenerationJobRow) {
  const rows = await getRequiredSupabaseAdminClient()
    .from("credit_ledger")
    .select("amount")
    .eq("job_id", job.id)
    .then(unwrapSupabaseData<Array<{ amount: number }>>);
  const netAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  return Math.min(job.cost ?? 0, Math.max(0, -netAmount));
}

function isRefundableGenerationStatus(status: GenerationJobStatus) {
  return status === "failed" || status === "expired";
}

async function fetchFriends(userId: string): Promise<Friend[]> {
  const supabase = getRequiredSupabaseAdminClient();
  const friendships = await supabase
    .from("friendships")
    .select("user_a_id, user_b_id")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .then(unwrapSupabaseData<FriendshipRow[]>);
  const friendIds = friendships.map((friendship) =>
    friendship.user_a_id === userId ? friendship.user_b_id : friendship.user_a_id
  );

  if (friendIds.length === 0) {
    return [];
  }

  const profiles = await supabase
    .from("profiles")
    .select("id, email, display_name, account_status")
    .in("id", friendIds)
    .then(unwrapSupabaseData<ProfileRow[]>);
  const hostedCounts = await hostedPetCounts(userId, friendIds);

  return profiles.map((profile) => mapFriendProfile(profile, hostedCounts.get(profile.id) ?? 0));
}

async function fetchHostingRequests(userId: string): Promise<HostingRequest[]> {
  const rows = await getRequiredSupabaseAdminClient()
    .from("pet_hosting_requests")
    .select("id, pet_id, from_user_id, to_user_id, status, updated_at")
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .then(unwrapSupabaseData<HostingRequestRow[]>);

  if (rows.length === 0) {
    return [];
  }

  const displayData = await fetchHostingRequestDisplayData(rows);
  return rows.map((row) => mapHostingRequestRowForViewer(row, userId, displayData));
}

type HostingRequestDisplayData = {
  petNames: Map<string, string>;
  userNames: Map<string, string>;
};

async function fetchHostingRequestDisplayData(
  rows: HostingRequestRow[]
): Promise<HostingRequestDisplayData> {
  const supabase = getRequiredSupabaseAdminClient();
  const petIds = [...new Set(rows.map((row) => row.pet_id))];
  const userIds = [
    ...new Set(rows.flatMap((row) => [row.from_user_id, row.to_user_id]))
  ];

  const [pets, profiles] = await Promise.all([
    petIds.length === 0
      ? Promise.resolve([])
      : supabase
          .from("pets")
          .select("id, name")
          .in("id", petIds)
          .then(unwrapSupabaseData<Array<{ id: string; name: string }>>),
    userIds.length === 0
      ? Promise.resolve([])
      : supabase
          .from("profiles")
          .select("id, email, display_name, account_status")
          .in("id", userIds)
          .then(unwrapSupabaseData<ProfileRow[]>)
  ]);

  return {
    petNames: new Map(pets.map((pet) => [pet.id, pet.name])),
    userNames: new Map(profiles.map((profile) => [profile.id, profile.display_name ?? profile.email ?? profile.id]))
  };
}

function mapHostingRequestRowForViewer(
  row: HostingRequestRow,
  viewerUserId: string,
  displayData: HostingRequestDisplayData
): HostingRequest {
  const statusCode = normalizeHostingRequestStatus(row.status);
  const receiverName = displayData.userNames.get(row.to_user_id) ?? "好友";

  return {
    id: row.id,
    petId: row.pet_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    petName: displayData.petNames.get(row.pet_id) ?? "猫咪",
    from: row.from_user_id === viewerUserId
      ? "你"
      : displayData.userNames.get(row.from_user_id) ?? "好友",
    status: hostingRequestStatusText({
      statusCode,
      isReceiver: row.to_user_id === viewerUserId,
      receiverName
    }),
    statusCode
  };
}

function hostingRequestStatusForAction(action: HostingRequestAction) {
  switch (action) {
    case "accept":
      return "accepted";
    case "decline":
      return "declined";
    case "return":
      return "returned";
  }
}

function normalizeHostingRequestStatus(status: string): HostingRequest["statusCode"] {
  switch (status) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "returned":
      return "returned";
    default:
      return "pending";
  }
}

function hostingRequestStatusText(input: {
  statusCode: HostingRequest["statusCode"];
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

function mapUser(
  fallback: CurrentUser,
  profile: ProfileRow | null,
  balance: CreditBalanceRow | number | null
): CurrentUser {
  const creditBalance = typeof balance === "number" ? balance : balance?.balance;

  return {
    id: fallback.id,
    name: profile?.display_name ?? fallback.name,
    email: profile?.email ?? fallback.email,
    credits: creditBalance ?? fallback.credits
  };
}

function mapPetRow(row: PetRow, viewerUserId?: string): Pet {
  const ownership = ownershipForPet(row, viewerUserId);

  return {
    id: row.id,
    petNumber: row.pet_number,
    ownerUserId: row.owner_user_id,
    currentHostUserId: row.current_host_user_id,
    name: row.name,
    type: row.species,
    status: statusForPet(row, ownership),
    materialsReady: 0,
    mood: "同步",
    host: hostForPet(row, ownership),
    ownership,
    locationStatus: row.location_status,
    sourceImageUrl: row.source_image_url,
    frontImageUrl: row.front_image_url ?? row.avatar_url,
    isReadonly: row.asset_bundle_url === starterPetAssetBundleUrl
  };
}

function mapPetAssetRow(row: PetAssetRow): PetAsset {
  return {
    petId: row.pet_id,
    slot: row.slot,
    status: row.status,
    videoUrl: row.video_url
  };
}

function mapGenerationJobRow(row: GenerationJobRow): GenerationJob {
  return {
    jobId: row.provider_job_id ?? row.id,
    type: row.job_type,
    status: row.status,
    cost: row.cost ?? 0,
    petId: row.pet_id,
    slot: row.slot ?? undefined,
    progress:
      row.status === "succeeded" || row.status === "failed" || row.status === "expired"
        ? 100
        : undefined,
    resultUrl: row.result_url,
    message: row.error_message ?? undefined,
    createdAt: row.created_at,
    settings: undefined
  };
}

function mapFriendProfile(profile: ProfileRow, hostedPets: number): Friend {
  return {
    id: profile.id,
    name: profile.display_name ?? profile.email ?? profile.id,
    status: "离线",
    hostedPets
  };
}

function ownershipForPet(row: PetRow, viewerUserId?: string): Pet["ownership"] {
  if (viewerUserId && row.owner_user_id !== viewerUserId && row.current_host_user_id === viewerUserId) {
    return "hosted";
  }

  if (viewerUserId && row.owner_user_id === viewerUserId && row.current_host_user_id !== viewerUserId) {
    return "away";
  }

  return "owned";
}

function hostForPet(row: PetRow, ownership: Pet["ownership"]): Pet["host"] {
  if (ownership === "away" || row.location_status === "hosted_by_friend") {
    return "friend";
  }

  return "me";
}

function statusForPet(row: PetRow, ownership: Pet["ownership"]) {
  if (ownership === "hosted") {
    return "寄养在我的桌面";
  }

  if (ownership === "away" || row.location_status === "hosted_by_friend") {
    return "托管在朋友家";
  }

  if (row.location_status === "away") {
    return "暂未显示";
  }

  return "在我的桌面";
}

function isActiveGenerationJob(job: GenerationJob) {
  return job.status === "queued" || job.status === "running";
}

function mergeStoredAndProviderJob(
  storedJob: GenerationJob,
  providerJob: GenerationJob
): GenerationJob {
  return {
    ...storedJob,
    status: providerJob.status === "queued" ? "running" : providerJob.status,
    progress: providerJob.progress ?? storedJob.progress,
    resultUrl: providerJob.resultUrl ?? storedJob.resultUrl ?? null,
    lastFrameUrl: providerJob.lastFrameUrl ?? storedJob.lastFrameUrl ?? null,
    message: providerJob.message ?? storedJob.message,
    settings: storedJob.settings ?? providerJob.settings,
    sourceImageUrl: storedJob.sourceImageUrl ?? providerJob.sourceImageUrl,
    lastImageUrl: storedJob.lastImageUrl ?? providerJob.lastImageUrl
  };
}

function sortJobsNewestFirst(left: GenerationJob, right: GenerationJob) {
  return Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getRequiredSupabaseAdminClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return supabase;
}

function unwrapSupabaseData<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) {
    throw result.error;
  }

  return result.data as T;
}

function unwrapSupabaseMaybeData<T>(result: { data: unknown; error: unknown }): T | null {
  if (result.error) {
    const error = result.error as { code?: string };

    if (error.code !== "PGRST116") {
      throw result.error;
    }
  }

  return (result.data as T | null) ?? null;
}

function unwrapSupabaseMutation(result: { error: unknown }) {
  if (result.error) {
    throw result.error;
  }
}

function cleanSupabasePetName(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, 30) : null;
}

function cleanSupabaseDisplayName(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, 30) : null;
}

function cleanSupabaseEmail(value: string) {
  const trimmed = value.trim().toLowerCase();

  return trimmed ? trimmed.slice(0, 320) : null;
}

function orderedFriendIds(left: string, right: string) {
  return left < right ? [left, right] : [right, left];
}

async function hostedPetCount(ownerUserId: string, currentHostUserId: string) {
  const result = await getRequiredSupabaseAdminClient()
    .from("pets")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId)
    .eq("current_host_user_id", currentHostUserId);

  if (result.error) {
    throw result.error;
  }

  return result.count ?? 0;
}

async function hostedPetCounts(ownerUserId: string, currentHostUserIds: string[]) {
  if (currentHostUserIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await getRequiredSupabaseAdminClient()
    .from("pets")
    .select("current_host_user_id")
    .eq("owner_user_id", ownerUserId)
    .in("current_host_user_id", currentHostUserIds)
    .then(unwrapSupabaseData<Array<{ current_host_user_id: string | null }>>);

  return rows.reduce((counts, row) => {
    if (row.current_host_user_id) {
      counts.set(row.current_host_user_id, (counts.get(row.current_host_user_id) ?? 0) + 1);
    }

    return counts;
  }, new Map<string, number>());
}

export function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
