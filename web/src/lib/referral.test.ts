import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDiscountAmountCents,
  calculateReferralReward,
  defaultReferralSettings,
  formatCnyFromCents,
  normalizeReferralCode,
  normalizeReferralSettings
} from "./referral.ts";

test("normalizeReferralSettings returns default referral percentages", () => {
  assert.deepEqual(normalizeReferralSettings(null), defaultReferralSettings);
  assert.deepEqual(normalizeReferralSettings({}), defaultReferralSettings);
});

test("normalizeReferralSettings rejects unsafe percentages and keeps valid values", () => {
  assert.deepEqual(
    normalizeReferralSettings({
      rewardPercent: 12,
      firstRechargeDiscountPercent: 25
    }),
    {
      rewardPercent: 12,
      firstRechargeDiscountPercent: 25
    }
  );
  assert.deepEqual(
    normalizeReferralSettings({
      rewardPercent: -1,
      firstRechargeDiscountPercent: 101
    }),
    defaultReferralSettings
  );
  assert.deepEqual(
    normalizeReferralSettings({
      rewardPercent: 12.5,
      firstRechargeDiscountPercent: "20"
    }),
    defaultReferralSettings
  );
});

test("normalizeReferralCode trims and uppercases valid codes", () => {
  assert.equal(normalizeReferralCode(" creator-01 "), "CREATOR-01");
  assert.equal(normalizeReferralCode("blogger_2026"), "BLOGGER_2026");
});

test("normalizeReferralCode rejects invalid codes", () => {
  assert.throws(() => normalizeReferralCode("abc"), /REFERRAL_CODE_INVALID/);
  assert.throws(() => normalizeReferralCode("中文CODE"), /REFERRAL_CODE_INVALID/);
  assert.throws(() => normalizeReferralCode("creator 01"), /REFERRAL_CODE_INVALID/);
  assert.throws(() => normalizeReferralCode("A".repeat(33)), /REFERRAL_CODE_INVALID/);
});

test("calculateDiscountAmountCents uses integer cents", () => {
  assert.equal(calculateDiscountAmountCents(9990, 20), 1998);
  assert.equal(calculateDiscountAmountCents(9990, 0), 0);
});

test("calculateReferralReward derives money amount and display credits from recharge amount", () => {
  assert.deepEqual(calculateReferralReward({ amountCents: 9990, rewardPercent: 10 }), {
    rewardAmountCents: 999,
    rewardCredits: 9
  });
  assert.deepEqual(calculateReferralReward({ amountCents: 9990, rewardPercent: 0 }), {
    rewardAmountCents: 0,
    rewardCredits: 0
  });
});

test("formatCnyFromCents formats cents for admin and user displays", () => {
  assert.equal(formatCnyFromCents(999), "9.99");
  assert.equal(formatCnyFromCents(1000), "10.00");
});
