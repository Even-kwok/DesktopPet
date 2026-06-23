# Referral System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement email registration referral codes, admin-managed distribution settings, manual recharge recording, and independent referral reward evidence.

**Architecture:** Add a focused referral domain layer for normalization and calculations, then a server store that supports mock and Supabase persistence. Registration, admin APIs, the admin page, and the studio billing panel all consume the same store APIs so future payment callbacks can reuse `recordAdminRecharge`/reward posting.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase service-role server queries, Node test runner, existing CSS system.

---

### Task 1: Pure Referral Rules

**Files:**
- Create: `web/src/lib/referral.ts`
- Test: `web/src/lib/referral.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Write failing tests**

Create `web/src/lib/referral.test.ts` with tests for:
- default settings normalize to `{ rewardPercent: 10, firstRechargeDiscountPercent: 20 }`
- invalid percentage values fall back to defaults
- code normalization uppercases `creator-01`
- invalid codes throw `REFERRAL_CODE_INVALID`
- `calculateDiscountAmountCents(9990, 20)` returns `1998`
- `calculateReferralReward({ amountCents: 9990, rewardPercent: 10 })` returns `999` cents and `9` display credits

- [ ] **Step 2: Verify tests fail**

Run: `cd web && node --experimental-strip-types --test src/lib/referral.test.ts`

Expected: FAIL because `src/lib/referral.ts` does not exist.

- [ ] **Step 3: Implement minimal referral rules**

Create exports:
- `defaultReferralSettings`
- `normalizeReferralSettings`
- `normalizeReferralCode`
- `calculateDiscountAmountCents`
- `calculateReferralReward`
- `formatCnyFromCents`

- [ ] **Step 4: Verify tests pass**

Run: `cd web && node --experimental-strip-types --test src/lib/referral.test.ts`

Expected: PASS.

- [ ] **Step 5: Add test to unit script**

Add `src/lib/referral.test.ts` to `web/package.json` `test:unit`.

### Task 2: Types And Mock State

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/account-data-state.ts`
- Modify: `web/src/lib/mock-data.ts`
- Test: `web/src/lib/server/referral-store.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `web/src/lib/server/referral-store.test.ts` with tests that call the server store public API:
- `createAdminReferralCode` creates an uppercase active code for an existing user
- duplicate codes throw `REFERRAL_CODE_EXISTS`
- disabled codes are rejected by `resolveActiveReferralCode`
- `recordUserReferralAtRegistration` stores one attribution
- `recordAdminRecharge` with `paid` posts exactly one reward and updates normal credits only for the recharged user
- `recordAdminRecharge` with `pending` does not post a reward
- first-recharge discount used timestamp is set only on the first paid recharge

- [ ] **Step 2: Verify tests fail**

Run: `cd web && node --experimental-strip-types --test src/lib/server/referral-store.test.ts`

Expected: FAIL because `src/lib/server/referral-store.ts` does not exist.

- [ ] **Step 3: Extend shared types**

Add exported types:
- `ReferralSettings`
- `ReferralCode`
- `UserReferral`
- `ReferralRewardLedgerEntry`
- `RechargeRecord`
- `ReferralSummary`
- `AdminReferralOverview`

- [ ] **Step 4: Extend mock account state helpers**

Add referral arrays and recharge records to `AccountDataState`, clone them in `createMockAccountDataState`, and reset them in `resetMockAccountDataStateForTests`.

- [ ] **Step 5: Add mock referral data**

Add one active demo code such as `LIZI20`, one referred user, one paid recharge, and one reward ledger entry in `web/src/lib/mock-data.ts` so UI previews are populated.

### Task 3: Referral Store

**Files:**
- Create: `web/src/lib/server/referral-store.ts`
- Modify: `web/src/lib/server/account-data-store.ts`
- Test: `web/src/lib/server/referral-store.test.ts`

- [ ] **Step 1: Implement mock store first**

Implement:
- `loadReferralSettings`
- `saveReferralSettings`
- `listAdminReferralCodes`
- `createAdminReferralCode`
- `updateAdminReferralCodeStatus`
- `resolveActiveReferralCode`
- `recordUserReferralAtRegistration`
- `loadAccountReferralSummary`
- `recordAdminRecharge`
- `listAdminReferralRewards`
- `listAdminRechargeRecords`

Mock implementation should mutate existing in-memory account state through small exported helpers from `account-data-store.ts`.

- [ ] **Step 2: Verify store tests pass**

Run: `cd web && node --experimental-strip-types --test src/lib/server/referral-store.test.ts`

Expected: PASS.

- [ ] **Step 3: Implement Supabase persistence**

In the same store, add Supabase branches using `getSupabaseAdminClient()`:
- settings stored in `app_settings` key `referral_settings`
- `referral_codes`
- `user_referrals`
- `recharge_records`
- `referral_reward_ledger`
- `credit_balances`

- [ ] **Step 4: Keep mock tests green**

Run: `cd web && node --experimental-strip-types --test src/lib/server/referral-store.test.ts`

Expected: PASS.

### Task 4: Schema

**Files:**
- Modify: `docs/schema.sql`

- [ ] **Step 1: Add tables and columns**

Add SQL for:
- `referral_codes`
- `user_referrals`
- `referral_reward_ledger`
- new `recharge_records` columns
- RLS enablement
- service-role grants
- authenticated read policies for own referral data

- [ ] **Step 2: Static check**

Run: `rg -n "referral_codes|user_referrals|referral_reward_ledger|discount_percent" docs/schema.sql`

Expected: all four patterns are present.

### Task 5: Registration Referral Code

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/api/auth/register/route.ts`

- [ ] **Step 1: Write registration/UI tests where practical**

Extend or add lightweight tests around referral code normalization through route-adjacent helpers if extracted. If route tests become too coupled to Next internals, rely on store/domain tests and type checking.

- [ ] **Step 2: Add optional form field**

Add an optional `referralCode` input to the signed-out registration form.

- [ ] **Step 3: Wire register route**

Parse `referralCode`, resolve it before sign-up when supplied, and write `recordUserReferralAtRegistration` after provisioning. Return clear redirect messages for invalid or disabled codes.

- [ ] **Step 4: Verify route compiles**

Run: `cd web && npm run lint`

Expected: PASS or actionable TypeScript errors.

### Task 6: Admin APIs

**Files:**
- Create: `web/src/app/api/admin/referral/settings/route.ts`
- Create: `web/src/app/api/admin/referral/codes/route.ts`
- Create: `web/src/app/api/admin/referral/codes/[codeId]/route.ts`
- Create: `web/src/app/api/admin/recharges/route.ts`

- [ ] **Step 1: Implement settings API**

`GET` and `PATCH` with admin auth, zod validation, and `loadReferralSettings`/`saveReferralSettings`.

- [ ] **Step 2: Implement referral code APIs**

`POST /api/admin/referral/codes` creates codes by owner email or owner id. `PATCH /api/admin/referral/codes/[codeId]` updates status.

- [ ] **Step 3: Implement recharge API**

`POST /api/admin/recharges` records manual recharge and returns updated recharge, reward if any, and account referral summary fields.

- [ ] **Step 4: Verify TypeScript**

Run: `cd web && npm run lint`

Expected: PASS or actionable TypeScript errors.

### Task 7: Admin UI

**Files:**
- Create: `web/src/components/admin/referral-admin-panel.tsx`
- Modify: `web/src/app/admin/page.tsx`
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Build client component**

Create a compact panel with:
- settings editor
- create code form
- code table with enable/disable buttons
- recharge form
- reward ledger table

- [ ] **Step 2: Feed admin data**

Load referral settings, codes, recharge records, and reward ledger in `AdminPage`; pass users from existing overview for selectors.

- [ ] **Step 3: Add CSS using existing admin patterns**

Reuse `.admin-table`, `.settings-grid`, `.admin-save-state`, and add only focused classes for referral layout.

- [ ] **Step 4: Verify TypeScript**

Run: `cd web && npm run lint`

Expected: PASS or actionable TypeScript errors.

### Task 8: Studio Referral Summary

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/server/studio-data.ts`
- Modify: `web/src/components/studio/studio-app.tsx`
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Extend bootstrap data**

Add `referralSummary: ReferralSummary` to `StudioBootstrap` and load it from `loadAccountReferralSummary`.

- [ ] **Step 2: Render billing summary**

Pass `initialData.referralSummary` to `BillingTab` and show active code, referred count, reward total, and non-withdrawable note.

- [ ] **Step 3: Verify TypeScript**

Run: `cd web && npm run lint`

Expected: PASS or actionable TypeScript errors.

### Task 9: Admin Overview Integration

**Files:**
- Modify: `web/src/lib/admin-overview.ts`
- Modify: `web/src/lib/admin-overview.test.ts`
- Modify: `web/src/app/admin/page.tsx`
- Modify: `web/src/app/api/admin/overview/route.ts`

- [ ] **Step 1: Write failing overview test**

Extend `admin-overview.test.ts` to assert referral metrics exist:
- `referralCodes`
- `referralRewards`
- `referralRewardAmountCents`

- [ ] **Step 2: Verify test fails**

Run: `cd web && node --experimental-strip-types --test src/lib/admin-overview.test.ts`

Expected: FAIL because metrics do not exist.

- [ ] **Step 3: Add optional referral inputs to overview builder**

Allow referral codes, rewards, and recharge records to feed metrics and admin tables without breaking existing callers.

- [ ] **Step 4: Verify overview test passes**

Run: `cd web && node --experimental-strip-types --test src/lib/admin-overview.test.ts`

Expected: PASS.

### Task 10: Full Verification

**Files:**
- All touched files

- [ ] **Step 1: Run unit tests**

Run: `cd web && npm run test:unit`

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run: `cd web && npm run lint`

Expected: PASS.

- [ ] **Step 3: Run Swift package tests**

Run: `swift test`

Expected: PASS.

- [ ] **Step 4: Review diff**

Run: `git diff --stat` and `git diff --check`

Expected: no whitespace errors and only referral-related files changed.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add docs/schema.sql docs/superpowers/plans/2026-06-23-referral-system.md web/package.json web/src
git commit -m "feat: add referral system foundation"
```
