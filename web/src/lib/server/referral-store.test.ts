import test from "node:test";
import assert from "node:assert/strict";
import {
  getMockAccountDataState,
  resetMockAccountDataStateForTests
} from "./mock-account-state.ts";
import {
  createAdminReferralCode,
  listAdminReferralRewards,
  loadAccountReferralSummary,
  recordAdminRecharge,
  recordUserReferralAtRegistration,
  resolveActiveReferralCode,
  updateAdminReferralCodeStatus
} from "./referral-store.ts";
import type { CurrentUser } from "../types.ts";

const referrer: CurrentUser = {
  id: "referrer_1",
  name: "推广博主",
  email: "creator@example.com",
  credits: 50
};

const referred: CurrentUser = {
  id: "referred_1",
  name: "新用户",
  email: "new@example.com",
  credits: 0
};

function resetReferralState() {
  resetMockAccountDataStateForTests({
    users: [referrer, referred],
    pets: [],
    assets: [],
    friends: [],
    hostingRequests: [],
    referralCodes: [],
    userReferrals: [],
    referralRewardLedger: [],
    rechargeRecords: []
  });
}

async function createActiveCode() {
  return createAdminReferralCode({
    ownerEmail: referrer.email,
    code: "lizi20",
    createdByUserId: "admin_demo"
  });
}

test("createAdminReferralCode creates an uppercase active code for an existing user", async () => {
  resetReferralState();

  const code = await createActiveCode();

  assert.equal(code.code, "LIZI20");
  assert.equal(code.ownerUserId, referrer.id);
  assert.equal(code.ownerEmail, referrer.email);
  assert.equal(code.status, "active");
});

test("createAdminReferralCode rejects duplicate codes", async () => {
  resetReferralState();
  await createActiveCode();

  await assert.rejects(() => createActiveCode(), /REFERRAL_CODE_EXISTS/);
});

test("resolveActiveReferralCode rejects disabled codes", async () => {
  resetReferralState();
  const code = await createActiveCode();

  await updateAdminReferralCodeStatus({ codeId: code.id, status: "disabled" });

  await assert.rejects(() => resolveActiveReferralCode("lizi20"), /REFERRAL_CODE_INVALID/);
});

test("recordUserReferralAtRegistration stores one registration attribution", async () => {
  resetReferralState();
  await createActiveCode();

  const referral = await recordUserReferralAtRegistration({
    referredUserId: referred.id,
    referralCode: "lizi20",
    now: new Date("2026-06-23T09:00:00.000Z")
  });
  const summary = await loadAccountReferralSummary(referrer);

  assert.equal(referral.referredUserId, referred.id);
  assert.equal(referral.referrerUserId, referrer.id);
  assert.equal(referral.rewardPercentAtRegistration, 10);
  assert.equal(referral.firstRechargeDiscountPercentAtRegistration, 20);
  assert.equal(summary.referredUsers, 1);
});

test("recordAdminRecharge posts paid referral rewards once per recharge and only credits the buyer", async () => {
  resetReferralState();
  await createActiveCode();
  await recordUserReferralAtRegistration({
    referredUserId: referred.id,
    referralCode: "lizi20"
  });

  const first = await recordAdminRecharge({
    id: "recharge_1",
    userId: referred.id,
    amountCents: 10000,
    creditsGranted: 1200,
    status: "paid",
    note: "首充"
  });
  const duplicate = await recordAdminRecharge({
    id: "recharge_1",
    userId: referred.id,
    amountCents: 10000,
    creditsGranted: 1200,
    status: "paid",
    note: "重复保存"
  });
  const accountState = getMockAccountDataState();
  const rewards = await listAdminReferralRewards();

  assert.equal(first.recharge.discountPercent, 20);
  assert.equal(first.recharge.discountAmountCents, 2000);
  assert.equal(first.reward?.rewardAmountCents, 1000);
  assert.equal(first.reward?.rewardCredits, 10);
  assert.equal(duplicate.reward?.id, first.reward?.id);
  assert.equal(rewards.length, 1);
  assert.equal(accountState.users.find((user) => user.id === referred.id)?.credits, 1200);
  assert.equal(accountState.users.find((user) => user.id === referrer.id)?.credits, 50);
});

test("recordAdminRecharge does not post rewards or use first discount for pending recharge", async () => {
  resetReferralState();
  await createActiveCode();
  await recordUserReferralAtRegistration({
    referredUserId: referred.id,
    referralCode: "lizi20"
  });

  const pending = await recordAdminRecharge({
    id: "recharge_pending",
    userId: referred.id,
    amountCents: 10000,
    creditsGranted: 1200,
    status: "pending",
    note: "待支付"
  });
  const paid = await recordAdminRecharge({
    id: "recharge_paid",
    userId: referred.id,
    amountCents: 10000,
    creditsGranted: 1200,
    status: "paid",
    note: "首充"
  });

  assert.equal(pending.reward, null);
  assert.equal(pending.recharge.discountPercent, 20);
  assert.equal(paid.recharge.discountPercent, 20);
  assert.equal((await listAdminReferralRewards()).length, 1);
});

test("recordAdminRecharge applies first-recharge discount once while rewards continue", async () => {
  resetReferralState();
  await createActiveCode();
  await recordUserReferralAtRegistration({
    referredUserId: referred.id,
    referralCode: "lizi20"
  });

  const first = await recordAdminRecharge({
    id: "recharge_first",
    userId: referred.id,
    amountCents: 10000,
    creditsGranted: 1000,
    status: "paid"
  });
  const second = await recordAdminRecharge({
    id: "recharge_second",
    userId: referred.id,
    amountCents: 20000,
    creditsGranted: 2000,
    status: "paid"
  });
  const summary = await loadAccountReferralSummary(referrer);

  assert.equal(first.recharge.discountPercent, 20);
  assert.equal(second.recharge.discountPercent, 0);
  assert.equal((await listAdminReferralRewards()).length, 2);
  assert.equal(summary.rewardAmountCents, 3000);
  assert.equal(summary.rewardCredits, 30);
});
