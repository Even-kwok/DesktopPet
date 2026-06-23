import {
  calculateDiscountAmountCents,
  calculateReferralReward,
  defaultReferralSettings,
  normalizeReferralCode,
  normalizeReferralSettings
} from "../referral.ts";
import { getBackendStatus, getSupabaseAdminClient } from "../supabase/server.ts";
import type {
  CurrentUser,
  RechargeRecord,
  RechargeRecordStatus,
  ReferralCode,
  ReferralCodeStatus,
  ReferralRewardLedgerEntry,
  ReferralSettings,
  ReferralSummary,
  UserReferral
} from "../types.ts";
import { getMockAccountDataState } from "./mock-account-state.ts";

const referralSettingsKey = "referral_settings";
const defaultCurrency = "CNY";

type CreateReferralCodeInput = {
  ownerUserId?: string;
  ownerEmail?: string;
  code: string;
  createdByUserId?: string | null;
};

type RecordReferralInput = {
  referredUserId: string;
  referralCode: string;
  now?: Date;
};

type RecordRechargeInput = {
  id?: string;
  userId?: string;
  userEmail?: string;
  amountCents: number;
  creditsGranted: number;
  status: RechargeRecordStatus;
  note?: string | null;
  provider?: string;
  providerTransactionId?: string | null;
  now?: Date;
};

type RecordRechargeResult = {
  recharge: RechargeRecord;
  reward: ReferralRewardLedgerEntry | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type ReferralCodeRow = {
  id: string;
  code: string;
  owner_user_id: string;
  status: ReferralCodeStatus;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type UserReferralRow = {
  referred_user_id: string;
  referral_code_id: string;
  referrer_user_id: string;
  registered_at: string;
  reward_percent_at_registration: number;
  first_recharge_discount_percent_at_registration: number;
  first_recharge_discount_used_at: string | null;
};

type RechargeRecordRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_transaction_id: string | null;
  amount_cents: number;
  currency: string;
  credits_granted: number;
  status: RechargeRecordStatus;
  discount_percent: number | null;
  discount_amount_cents: number | null;
  referral_code_id: string | null;
  referred_by_user_id: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type ReferralRewardRow = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code_id: string;
  recharge_record_id: string;
  amount_cents: number;
  currency: string;
  reward_percent: number;
  reward_amount_cents: number;
  reward_credits: number;
  status: "posted" | "voided";
  created_at: string;
};

let mockReferralSettings = defaultReferralSettings;

export async function loadReferralSettings(): Promise<ReferralSettings> {
  const supabase = getSupabaseAdminClient();

  if (getBackendStatus().mode === "supabase" && supabase) {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", referralSettingsKey)
      .maybeSingle();

    if (!error && data) {
      return normalizeReferralSettings((data as { value: unknown }).value);
    }
  }

  return mockReferralSettings;
}

export async function saveReferralSettings(patch: unknown): Promise<ReferralSettings> {
  const settings = normalizeReferralSettings(patch);
  const supabase = getSupabaseAdminClient();

  if (getBackendStatus().mode === "supabase" && supabase) {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: referralSettingsKey,
          value: settings,
          updated_at: new Date().toISOString()
        },
        { onConflict: "key" }
      )
      .select("value")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "REFERRAL_SETTINGS_SAVE_FAILED");
    }

    return normalizeReferralSettings((data as { value: unknown }).value);
  }

  mockReferralSettings = settings;
  return mockReferralSettings;
}

export async function listAdminReferralCodes(): Promise<ReferralCode[]> {
  if (getBackendStatus().mode !== "supabase") {
    return getMockAccountDataState().referralCodes.map(enrichMockReferralCode);
  }

  const supabase = getRequiredSupabaseAdminClient();
  const rows = await supabase
    .from("referral_codes")
    .select("id, code, owner_user_id, status, created_by_user_id, created_at, updated_at")
    .then(unwrapSupabaseData<ReferralCodeRow[]>);

  return enrichSupabaseReferralCodes(rows);
}

export async function createAdminReferralCode(input: CreateReferralCodeInput): Promise<ReferralCode> {
  const code = normalizeReferralCode(input.code);

  if (getBackendStatus().mode !== "supabase") {
    const state = getMockAccountDataState();
    const owner = findMockUser(input);

    if (!owner) {
      throw new Error("REFERRAL_OWNER_NOT_FOUND");
    }

    if (state.referralCodes.some((item) => item.code === code)) {
      throw new Error("REFERRAL_CODE_EXISTS");
    }

    const now = new Date().toISOString();
    const referralCode: ReferralCode = {
      id: `refcode_${globalThis.crypto.randomUUID()}`,
      code,
      ownerUserId: owner.id,
      ownerName: owner.name,
      ownerEmail: owner.email,
      status: "active",
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
      referredUsers: 0,
      rewardAmountCents: 0,
      rewardCredits: 0
    };

    state.referralCodes.push(referralCode);
    return referralCode;
  }

  return createSupabaseReferralCode({ ...input, code });
}

export async function updateAdminReferralCodeStatus(input: {
  codeId: string;
  status: ReferralCodeStatus;
}): Promise<ReferralCode> {
  if (input.status !== "active" && input.status !== "disabled") {
    throw new Error("REFERRAL_CODE_INVALID");
  }

  if (getBackendStatus().mode !== "supabase") {
    const state = getMockAccountDataState();
    const index = state.referralCodes.findIndex((code) => code.id === input.codeId);

    if (index < 0) {
      throw new Error("REFERRAL_CODE_INVALID");
    }

    state.referralCodes[index] = {
      ...state.referralCodes[index],
      status: input.status,
      updatedAt: new Date().toISOString()
    };

    return enrichMockReferralCode(state.referralCodes[index]);
  }

  const supabase = getRequiredSupabaseAdminClient();
  const row = await supabase
    .from("referral_codes")
    .update({
      status: input.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.codeId)
    .select("id, code, owner_user_id, status, created_by_user_id, created_at, updated_at")
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<ReferralCodeRow>);

  if (!row) {
    throw new Error("REFERRAL_CODE_INVALID");
  }

  return (await enrichSupabaseReferralCodes([row]))[0];
}

export async function resolveActiveReferralCode(codeValue: string): Promise<ReferralCode> {
  const code = normalizeReferralCode(codeValue);

  if (getBackendStatus().mode !== "supabase") {
    const referralCode = getMockAccountDataState().referralCodes.find(
      (item) => item.code === code && item.status === "active"
    );

    if (!referralCode) {
      throw new Error("REFERRAL_CODE_INVALID");
    }

    return enrichMockReferralCode(referralCode);
  }

  const supabase = getRequiredSupabaseAdminClient();
  const row = await supabase
    .from("referral_codes")
    .select("id, code, owner_user_id, status, created_by_user_id, created_at, updated_at")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<ReferralCodeRow>);

  if (!row) {
    throw new Error("REFERRAL_CODE_INVALID");
  }

  return (await enrichSupabaseReferralCodes([row]))[0];
}

export async function recordUserReferralAtRegistration(
  input: RecordReferralInput
): Promise<UserReferral> {
  const referralCode = await resolveActiveReferralCode(input.referralCode);

  if (referralCode.ownerUserId === input.referredUserId) {
    throw new Error("REFERRAL_SELF_REFERRAL");
  }

  const settings = await loadReferralSettings();
  const now = (input.now ?? new Date()).toISOString();

  if (getBackendStatus().mode !== "supabase") {
    const state = getMockAccountDataState();
    const existing = state.userReferrals.find(
      (referral) => referral.referredUserId === input.referredUserId
    );

    if (existing) {
      return existing;
    }

    const referral: UserReferral = {
      referredUserId: input.referredUserId,
      referralCodeId: referralCode.id,
      referralCode: referralCode.code,
      referrerUserId: referralCode.ownerUserId,
      registeredAt: now,
      rewardPercentAtRegistration: settings.rewardPercent,
      firstRechargeDiscountPercentAtRegistration: settings.firstRechargeDiscountPercent,
      firstRechargeDiscountUsedAt: null
    };

    state.userReferrals.push(referral);
    return referral;
  }

  const supabase = getRequiredSupabaseAdminClient();
  const existing = await supabase
    .from("user_referrals")
    .select(
      "referred_user_id, referral_code_id, referrer_user_id, registered_at, reward_percent_at_registration, first_recharge_discount_percent_at_registration, first_recharge_discount_used_at"
    )
    .eq("referred_user_id", input.referredUserId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<UserReferralRow>);

  if (existing) {
    return mapUserReferralRow(existing, referralCode.code);
  }

  const row = await supabase
    .from("user_referrals")
    .insert({
      referred_user_id: input.referredUserId,
      referral_code_id: referralCode.id,
      referrer_user_id: referralCode.ownerUserId,
      registered_at: now,
      reward_percent_at_registration: settings.rewardPercent,
      first_recharge_discount_percent_at_registration: settings.firstRechargeDiscountPercent
    })
    .select(
      "referred_user_id, referral_code_id, referrer_user_id, registered_at, reward_percent_at_registration, first_recharge_discount_percent_at_registration, first_recharge_discount_used_at"
    )
    .single()
    .then(unwrapSupabaseData<UserReferralRow>);

  return mapUserReferralRow(row, referralCode.code);
}

export async function loadAccountReferralSummary(account: CurrentUser): Promise<ReferralSummary> {
  const settings = await loadReferralSettings();

  if (getBackendStatus().mode !== "supabase") {
    const state = getMockAccountDataState();
    const activeCode =
      state.referralCodes.find((code) => code.ownerUserId === account.id && code.status === "active") ??
      null;
    const rewards = state.referralRewardLedger
      .filter((reward) => reward.referrerUserId === account.id && reward.status === "posted")
      .map(enrichMockReferralReward);
    const referredUsers = state.userReferrals.filter(
      (referral) => referral.referrerUserId === account.id
    ).length;

    return {
      activeCode: activeCode ? enrichMockReferralCode(activeCode) : null,
      referredUsers,
      rewardAmountCents: rewards.reduce((sum, reward) => sum + reward.rewardAmountCents, 0),
      rewardCredits: rewards.reduce((sum, reward) => sum + reward.rewardCredits, 0),
      rewardPercent: settings.rewardPercent,
      firstRechargeDiscountPercent: settings.firstRechargeDiscountPercent,
      rewards
    };
  }

  return loadSupabaseAccountReferralSummary(account, settings);
}

export async function recordAdminRecharge(
  input: RecordRechargeInput
): Promise<RecordRechargeResult> {
  cleanRechargeInput(input);

  if (getBackendStatus().mode !== "supabase") {
    return recordMockAdminRecharge(input);
  }

  return recordSupabaseAdminRecharge(input);
}

export async function listAdminReferralRewards(): Promise<ReferralRewardLedgerEntry[]> {
  if (getBackendStatus().mode !== "supabase") {
    return getMockAccountDataState().referralRewardLedger.map(enrichMockReferralReward);
  }

  const supabase = getRequiredSupabaseAdminClient();
  const rows = await supabase
    .from("referral_reward_ledger")
    .select(
      "id, referrer_user_id, referred_user_id, referral_code_id, recharge_record_id, amount_cents, currency, reward_percent, reward_amount_cents, reward_credits, status, created_at"
    )
    .order("created_at", { ascending: false })
    .then(unwrapSupabaseData<ReferralRewardRow[]>);

  return enrichSupabaseReferralRewards(rows);
}

export async function listAdminRechargeRecords(): Promise<RechargeRecord[]> {
  if (getBackendStatus().mode !== "supabase") {
    return [...getMockAccountDataState().rechargeRecords].sort(sortNewestFirst);
  }

  const supabase = getRequiredSupabaseAdminClient();
  const rows = await supabase
    .from("recharge_records")
    .select(
      "id, user_id, provider, provider_transaction_id, amount_cents, currency, credits_granted, status, discount_percent, discount_amount_cents, referral_code_id, referred_by_user_id, paid_at, note, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .then(unwrapSupabaseData<RechargeRecordRow[]>);

  return rows.map(mapRechargeRecordRow);
}

async function createSupabaseReferralCode(input: CreateReferralCodeInput): Promise<ReferralCode> {
  const supabase = getRequiredSupabaseAdminClient();
  const owner = await findSupabaseUser(input);

  if (!owner) {
    throw new Error("REFERRAL_OWNER_NOT_FOUND");
  }

  const existing = await supabase
    .from("referral_codes")
    .select("id")
    .eq("code", input.code)
    .maybeSingle();

  if (existing.data) {
    throw new Error("REFERRAL_CODE_EXISTS");
  }

  if (existing.error) {
    throw existing.error;
  }

  const now = new Date().toISOString();
  const row = await supabase
    .from("referral_codes")
    .insert({
      code: input.code,
      owner_user_id: owner.id,
      status: "active",
      created_by_user_id: input.createdByUserId ?? null,
      updated_at: now
    })
    .select("id, code, owner_user_id, status, created_by_user_id, created_at, updated_at")
    .single()
    .then(unwrapSupabaseData<ReferralCodeRow>);

  return {
    ...mapReferralCodeRow(row),
    ownerName: owner.display_name ?? owner.email ?? owner.id,
    ownerEmail: owner.email ?? undefined,
    referredUsers: 0,
    rewardAmountCents: 0,
    rewardCredits: 0
  };
}

async function recordMockAdminRecharge(input: RecordRechargeInput): Promise<RecordRechargeResult> {
  const state = getMockAccountDataState();
  const user = findRechargeUser(input);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const now = (input.now ?? new Date()).toISOString();
  const id = input.id ?? `recharge_${globalThis.crypto.randomUUID()}`;
  const existingIndex = state.rechargeRecords.findIndex((record) => record.id === id);
  const existing = existingIndex >= 0 ? state.rechargeRecords[existingIndex] : null;
  const wasPaid = existing?.status === "paid";
  const referral = state.userReferrals.find((item) => item.referredUserId === user.id) ?? null;
  const shouldApplyFirstDiscount =
    Boolean(referral) &&
    (input.status !== "paid" || !referral?.firstRechargeDiscountUsedAt);
  const discountPercent = shouldApplyFirstDiscount
    ? referral?.firstRechargeDiscountPercentAtRegistration ?? 0
    : 0;
  const discountAmountCents = calculateDiscountAmountCents(input.amountCents, discountPercent);
  const recharge: RechargeRecord = {
    id,
    userId: user.id,
    provider: input.provider ?? "admin_manual",
    providerTransactionId: input.providerTransactionId ?? null,
    amountCents: input.amountCents,
    currency: existing?.currency ?? defaultCurrency,
    creditsGranted: input.creditsGranted,
    status: input.status,
    discountPercent,
    discountAmountCents,
    referralCodeId: referral?.referralCodeId ?? null,
    referredByUserId: referral?.referrerUserId ?? null,
    paidAt: input.status === "paid" ? existing?.paidAt ?? now : null,
    note: input.note ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    state.rechargeRecords[existingIndex] = recharge;
  } else {
    state.rechargeRecords.unshift(recharge);
  }

  if (input.status === "paid" && !wasPaid) {
    user.credits += input.creditsGranted;

    if (referral && !referral.firstRechargeDiscountUsedAt) {
      referral.firstRechargeDiscountUsedAt = now;
    }
  }

  const reward = input.status === "paid" && referral
    ? postMockReferralRewardForRecharge(recharge, referral, now)
    : null;

  return { recharge, reward };
}

async function recordSupabaseAdminRecharge(
  input: RecordRechargeInput
): Promise<RecordRechargeResult> {
  const supabase = getRequiredSupabaseAdminClient();
  const user = await findSupabaseUser(input);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const now = (input.now ?? new Date()).toISOString();
  const id = input.id ?? globalThis.crypto.randomUUID();
  const existing = await supabase
    .from("recharge_records")
    .select(
      "id, user_id, provider, provider_transaction_id, amount_cents, currency, credits_granted, status, discount_percent, discount_amount_cents, referral_code_id, referred_by_user_id, paid_at, note, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<RechargeRecordRow>);
  const referral = await fetchSupabaseUserReferral(user.id);
  const shouldApplyFirstDiscount =
    Boolean(referral) &&
    (input.status !== "paid" || !referral?.first_recharge_discount_used_at);
  const discountPercent = shouldApplyFirstDiscount
    ? referral?.first_recharge_discount_percent_at_registration ?? 0
    : 0;
  const discountAmountCents = calculateDiscountAmountCents(input.amountCents, discountPercent);
  const row = await supabase
    .from("recharge_records")
    .upsert(
      {
        id,
        user_id: user.id,
        provider: input.provider ?? "admin_manual",
        provider_transaction_id: input.providerTransactionId ?? null,
        amount_cents: input.amountCents,
        currency: existing?.currency ?? defaultCurrency,
        credits_granted: input.creditsGranted,
        status: input.status,
        discount_percent: discountPercent,
        discount_amount_cents: discountAmountCents,
        referral_code_id: referral?.referral_code_id ?? null,
        referred_by_user_id: referral?.referrer_user_id ?? null,
        paid_at: input.status === "paid" ? existing?.paid_at ?? now : null,
        note: input.note ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now
      },
      { onConflict: "id" }
    )
    .select(
      "id, user_id, provider, provider_transaction_id, amount_cents, currency, credits_granted, status, discount_percent, discount_amount_cents, referral_code_id, referred_by_user_id, paid_at, note, created_at, updated_at"
    )
    .single()
    .then(unwrapSupabaseData<RechargeRecordRow>);
  const recharge = mapRechargeRecordRow(row);

  if (input.status === "paid" && existing?.status !== "paid") {
    await incrementSupabaseCredits(user.id, input.creditsGranted);

    if (referral && !referral.first_recharge_discount_used_at) {
      await supabase
        .from("user_referrals")
        .update({ first_recharge_discount_used_at: now })
        .eq("referred_user_id", user.id)
        .then(unwrapSupabaseResult);
    }
  }

  const reward = input.status === "paid" && referral
    ? await postSupabaseReferralRewardForRecharge(recharge, referral, now)
    : null;

  return { recharge, reward };
}

function postMockReferralRewardForRecharge(
  recharge: RechargeRecord,
  referral: UserReferral,
  now: string
): ReferralRewardLedgerEntry {
  const state = getMockAccountDataState();
  const existing = state.referralRewardLedger.find(
    (reward) => reward.rechargeRecordId === recharge.id
  );

  if (existing) {
    return enrichMockReferralReward(existing);
  }

  const calculation = calculateReferralReward({
    amountCents: recharge.amountCents,
    rewardPercent: referral.rewardPercentAtRegistration
  });
  const reward: ReferralRewardLedgerEntry = {
    id: `reward_${globalThis.crypto.randomUUID()}`,
    referrerUserId: referral.referrerUserId,
    referredUserId: referral.referredUserId,
    referralCodeId: referral.referralCodeId,
    referralCode: referral.referralCode,
    rechargeRecordId: recharge.id,
    amountCents: recharge.amountCents,
    currency: recharge.currency,
    rewardPercent: referral.rewardPercentAtRegistration,
    rewardAmountCents: calculation.rewardAmountCents,
    rewardCredits: calculation.rewardCredits,
    status: "posted",
    createdAt: now
  };

  state.referralRewardLedger.unshift(reward);
  return enrichMockReferralReward(reward);
}

async function postSupabaseReferralRewardForRecharge(
  recharge: RechargeRecord,
  referral: UserReferralRow,
  now: string
): Promise<ReferralRewardLedgerEntry> {
  const supabase = getRequiredSupabaseAdminClient();
  const existing = await supabase
    .from("referral_reward_ledger")
    .select(
      "id, referrer_user_id, referred_user_id, referral_code_id, recharge_record_id, amount_cents, currency, reward_percent, reward_amount_cents, reward_credits, status, created_at"
    )
    .eq("recharge_record_id", recharge.id)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<ReferralRewardRow>);

  if (existing) {
    return (await enrichSupabaseReferralRewards([existing]))[0];
  }

  const calculation = calculateReferralReward({
    amountCents: recharge.amountCents,
    rewardPercent: referral.reward_percent_at_registration
  });
  const inserted = await supabase
    .from("referral_reward_ledger")
    .insert({
      referrer_user_id: referral.referrer_user_id,
      referred_user_id: referral.referred_user_id,
      referral_code_id: referral.referral_code_id,
      recharge_record_id: recharge.id,
      amount_cents: recharge.amountCents,
      currency: recharge.currency,
      reward_percent: referral.reward_percent_at_registration,
      reward_amount_cents: calculation.rewardAmountCents,
      reward_credits: calculation.rewardCredits,
      status: "posted",
      created_at: now
    })
    .select(
      "id, referrer_user_id, referred_user_id, referral_code_id, recharge_record_id, amount_cents, currency, reward_percent, reward_amount_cents, reward_credits, status, created_at"
    )
    .single()
    .then(unwrapSupabaseData<ReferralRewardRow>);

  return (await enrichSupabaseReferralRewards([inserted]))[0];
}

async function loadSupabaseAccountReferralSummary(
  account: CurrentUser,
  settings: ReferralSettings
): Promise<ReferralSummary> {
  const supabase = getRequiredSupabaseAdminClient();
  const [codeRows, referralRows, rewardRows] = await Promise.all([
    supabase
      .from("referral_codes")
      .select("id, code, owner_user_id, status, created_by_user_id, created_at, updated_at")
      .eq("owner_user_id", account.id)
      .then(unwrapSupabaseData<ReferralCodeRow[]>),
    supabase
      .from("user_referrals")
      .select("referred_user_id")
      .eq("referrer_user_id", account.id)
      .then(unwrapSupabaseData<Array<{ referred_user_id: string }>>),
    supabase
      .from("referral_reward_ledger")
      .select(
        "id, referrer_user_id, referred_user_id, referral_code_id, recharge_record_id, amount_cents, currency, reward_percent, reward_amount_cents, reward_credits, status, created_at"
      )
      .eq("referrer_user_id", account.id)
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .then(unwrapSupabaseData<ReferralRewardRow[]>)
  ]);
  const rewards = await enrichSupabaseReferralRewards(rewardRows);
  const activeCode = codeRows.find((code) => code.status === "active") ?? null;

  return {
    activeCode: activeCode ? (await enrichSupabaseReferralCodes([activeCode]))[0] : null,
    referredUsers: referralRows.length,
    rewardAmountCents: rewards.reduce((sum, reward) => sum + reward.rewardAmountCents, 0),
    rewardCredits: rewards.reduce((sum, reward) => sum + reward.rewardCredits, 0),
    rewardPercent: settings.rewardPercent,
    firstRechargeDiscountPercent: settings.firstRechargeDiscountPercent,
    rewards
  };
}

async function fetchSupabaseUserReferral(userId: string) {
  const supabase = getRequiredSupabaseAdminClient();

  return supabase
    .from("user_referrals")
    .select(
      "referred_user_id, referral_code_id, referrer_user_id, registered_at, reward_percent_at_registration, first_recharge_discount_percent_at_registration, first_recharge_discount_used_at"
    )
    .eq("referred_user_id", userId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<UserReferralRow>);
}

async function incrementSupabaseCredits(userId: string, creditsGranted: number) {
  if (creditsGranted <= 0) {
    return;
  }

  const supabase = getRequiredSupabaseAdminClient();
  const existing = await supabase
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle()
    .then(unwrapSupabaseMaybeData<{ balance: number | null }>);
  const balance = Math.max(0, existing?.balance ?? 0) + creditsGranted;

  await supabase
    .from("credit_balances")
    .upsert(
      {
        user_id: userId,
        balance,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .then(unwrapSupabaseResult);

  await supabase
    .from("credit_ledger")
    .insert({
      user_id: userId,
      amount: creditsGranted,
      reason: "后台记录充值"
    })
    .then(unwrapSupabaseResult);
}

function enrichMockReferralCode(code: ReferralCode): ReferralCode {
  const state = getMockAccountDataState();
  const owner = state.users.find((user) => user.id === code.ownerUserId);
  const referredUsers = state.userReferrals.filter(
    (referral) => referral.referralCodeId === code.id
  ).length;
  const rewards = state.referralRewardLedger.filter(
    (reward) => reward.referralCodeId === code.id && reward.status === "posted"
  );

  return {
    ...code,
    ownerName: owner?.name ?? code.ownerName,
    ownerEmail: owner?.email ?? code.ownerEmail,
    referredUsers,
    rewardAmountCents: rewards.reduce((sum, reward) => sum + reward.rewardAmountCents, 0),
    rewardCredits: rewards.reduce((sum, reward) => sum + reward.rewardCredits, 0)
  };
}

function enrichMockReferralReward(reward: ReferralRewardLedgerEntry): ReferralRewardLedgerEntry {
  const state = getMockAccountDataState();
  const referrer = state.users.find((user) => user.id === reward.referrerUserId);
  const referred = state.users.find((user) => user.id === reward.referredUserId);
  const code = state.referralCodes.find((item) => item.id === reward.referralCodeId);

  return {
    ...reward,
    referrerName: referrer?.name ?? reward.referrerName,
    referrerEmail: referrer?.email ?? reward.referrerEmail,
    referredUserName: referred?.name ?? reward.referredUserName,
    referredUserEmail: referred?.email ?? reward.referredUserEmail,
    referralCode: code?.code ?? reward.referralCode
  };
}

async function enrichSupabaseReferralCodes(rows: ReferralCodeRow[]): Promise<ReferralCode[]> {
  const supabase = getRequiredSupabaseAdminClient();
  const ownerIds = Array.from(new Set(rows.map((row) => row.owner_user_id)));
  const codeIds = rows.map((row) => row.id);
  const [profiles, referrals, rewards] = await Promise.all([
    ownerIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", ownerIds)
          .then(unwrapSupabaseData<ProfileRow[]>)
      : [],
    codeIds.length > 0
      ? supabase
          .from("user_referrals")
          .select("referral_code_id")
          .in("referral_code_id", codeIds)
          .then(unwrapSupabaseData<Array<{ referral_code_id: string }>>)
      : [],
    codeIds.length > 0
      ? supabase
          .from("referral_reward_ledger")
          .select("referral_code_id, reward_amount_cents, reward_credits, status")
          .in("referral_code_id", codeIds)
          .then(
            unwrapSupabaseData<
              Array<{
                referral_code_id: string;
                reward_amount_cents: number;
                reward_credits: number;
                status: string;
              }>
            >
          )
      : []
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const profile = profilesById.get(row.owner_user_id);
    const rowRewards = rewards.filter(
      (reward) => reward.referral_code_id === row.id && reward.status === "posted"
    );

    return {
      ...mapReferralCodeRow(row),
      ownerName: profile?.display_name ?? profile?.email ?? row.owner_user_id,
      ownerEmail: profile?.email ?? undefined,
      referredUsers: referrals.filter((referral) => referral.referral_code_id === row.id).length,
      rewardAmountCents: rowRewards.reduce((sum, reward) => sum + reward.reward_amount_cents, 0),
      rewardCredits: rowRewards.reduce((sum, reward) => sum + reward.reward_credits, 0)
    };
  });
}

async function enrichSupabaseReferralRewards(
  rows: ReferralRewardRow[]
): Promise<ReferralRewardLedgerEntry[]> {
  const supabase = getRequiredSupabaseAdminClient();
  const userIds = Array.from(new Set(rows.flatMap((row) => [row.referrer_user_id, row.referred_user_id])));
  const codeIds = Array.from(new Set(rows.map((row) => row.referral_code_id)));
  const [profiles, codes] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds)
          .then(unwrapSupabaseData<ProfileRow[]>)
      : [],
    codeIds.length > 0
      ? supabase
          .from("referral_codes")
          .select("id, code")
          .in("id", codeIds)
          .then(unwrapSupabaseData<Array<{ id: string; code: string }>>)
      : []
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const codesById = new Map(codes.map((code) => [code.id, code.code]));

  return rows.map((row) => {
    const referrer = profilesById.get(row.referrer_user_id);
    const referred = profilesById.get(row.referred_user_id);

    return {
      id: row.id,
      referrerUserId: row.referrer_user_id,
      referrerName: referrer?.display_name ?? referrer?.email ?? row.referrer_user_id,
      referrerEmail: referrer?.email ?? undefined,
      referredUserId: row.referred_user_id,
      referredUserName: referred?.display_name ?? referred?.email ?? row.referred_user_id,
      referredUserEmail: referred?.email ?? undefined,
      referralCodeId: row.referral_code_id,
      referralCode: codesById.get(row.referral_code_id),
      rechargeRecordId: row.recharge_record_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      rewardPercent: row.reward_percent,
      rewardAmountCents: row.reward_amount_cents,
      rewardCredits: row.reward_credits,
      status: row.status,
      createdAt: row.created_at
    };
  });
}

function mapReferralCodeRow(row: ReferralCodeRow): ReferralCode {
  return {
    id: row.id,
    code: row.code,
    ownerUserId: row.owner_user_id,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUserReferralRow(row: UserReferralRow, referralCode: string): UserReferral {
  return {
    referredUserId: row.referred_user_id,
    referralCodeId: row.referral_code_id,
    referralCode,
    referrerUserId: row.referrer_user_id,
    registeredAt: row.registered_at,
    rewardPercentAtRegistration: row.reward_percent_at_registration,
    firstRechargeDiscountPercentAtRegistration:
      row.first_recharge_discount_percent_at_registration,
    firstRechargeDiscountUsedAt: row.first_recharge_discount_used_at
  };
}

function mapRechargeRecordRow(row: RechargeRecordRow): RechargeRecord {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerTransactionId: row.provider_transaction_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    creditsGranted: row.credits_granted,
    status: row.status,
    discountPercent: row.discount_percent ?? 0,
    discountAmountCents: row.discount_amount_cents ?? 0,
    referralCodeId: row.referral_code_id,
    referredByUserId: row.referred_by_user_id,
    paidAt: row.paid_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findMockUser(input: { ownerUserId?: string; ownerEmail?: string }) {
  const email = input.ownerEmail?.trim().toLowerCase();

  return getMockAccountDataState().users.find(
    (user) => user.id === input.ownerUserId || (email ? user.email.toLowerCase() === email : false)
  );
}

function findRechargeUser(input: { userId?: string; userEmail?: string }) {
  const email = input.userEmail?.trim().toLowerCase();

  return getMockAccountDataState().users.find(
    (user) => user.id === input.userId || (email ? user.email.toLowerCase() === email : false)
  );
}

async function findSupabaseUser(input: {
  ownerUserId?: string;
  ownerEmail?: string;
  userId?: string;
  userEmail?: string;
}) {
  const supabase = getRequiredSupabaseAdminClient();
  const id = input.ownerUserId ?? input.userId;
  const email = (input.ownerEmail ?? input.userEmail)?.trim().toLowerCase();

  let query = supabase.from("profiles").select("id, email, display_name");

  if (id) {
    query = query.eq("id", id);
  } else if (email) {
    query = query.eq("email", email);
  } else {
    return null;
  }

  return query.maybeSingle().then(unwrapSupabaseMaybeData<ProfileRow>);
}

function cleanRechargeInput(input: RecordRechargeInput) {
  if (!input.userId && !input.userEmail) {
    throw new Error("USER_NOT_FOUND");
  }

  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents < 0 ||
    !Number.isInteger(input.creditsGranted) ||
    input.creditsGranted < 0 ||
    !["pending", "paid", "failed", "refunded"].includes(input.status)
  ) {
    throw new Error("INVALID_RECHARGE_RECORD");
  }
}

function sortNewestFirst(left: RechargeRecord, right: RechargeRecord) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function getRequiredSupabaseAdminClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("SUPABASE_ADMIN_CLIENT_REQUIRED");
  }

  return supabase;
}

function unwrapSupabaseResult(result: { error: unknown }) {
  if (result.error) {
    throw result.error;
  }
}

function unwrapSupabaseData<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) {
    throw result.error;
  }

  return result.data as T;
}

function unwrapSupabaseMaybeData<T>(result: { data: unknown; error: unknown }): T | null {
  if (result.error) {
    throw result.error;
  }

  return (result.data as T | null) ?? null;
}
