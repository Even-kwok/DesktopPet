import type { ReferralSettings } from "./types.ts";

export type ReferralRewardCalculation = {
  rewardAmountCents: number;
  rewardCredits: number;
};

export const defaultReferralSettings: ReferralSettings = {
  rewardPercent: 10,
  firstRechargeDiscountPercent: 20
};

export function normalizeReferralSettings(value: unknown): ReferralSettings {
  if (!value || typeof value !== "object") {
    return defaultReferralSettings;
  }

  const input = value as Partial<Record<keyof ReferralSettings, unknown>>;
  const rewardPercent = cleanPercent(input.rewardPercent);
  const firstRechargeDiscountPercent = cleanPercent(input.firstRechargeDiscountPercent);

  return {
    rewardPercent: rewardPercent ?? defaultReferralSettings.rewardPercent,
    firstRechargeDiscountPercent:
      firstRechargeDiscountPercent ?? defaultReferralSettings.firstRechargeDiscountPercent
  };
}

export function normalizeReferralCode(value: string) {
  const code = value.trim().toUpperCase();

  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new Error("REFERRAL_CODE_INVALID");
  }

  return code;
}

export function calculateDiscountAmountCents(amountCents: number, discountPercent: number) {
  return Math.floor(cleanAmountCents(amountCents) * cleanCalculationPercent(discountPercent) / 100);
}

export function calculateReferralReward(input: {
  amountCents: number;
  rewardPercent: number;
}): ReferralRewardCalculation {
  const rewardAmountCents = Math.floor(
    cleanAmountCents(input.amountCents) * cleanCalculationPercent(input.rewardPercent) / 100
  );

  return {
    rewardAmountCents,
    rewardCredits: Math.floor(rewardAmountCents / 100)
  };
}

export function formatCnyFromCents(amountCents: number) {
  return (cleanAmountCents(amountCents) / 100).toFixed(2);
}

function cleanPercent(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function cleanCalculationPercent(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
}

function cleanAmountCents(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}
