# Admin Credit Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins adjust user credit balances with signed deltas and ledger reasons from the admin UI.

**Architecture:** Add a data-store mutation that supports mock and Supabase modes, expose it through an admin-only Next.js route, and add a focused client editor to the admin user section. Tests start at the mock state mutation because it captures the core balance and validation behavior without mocking the web framework.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node test runner, Supabase.

---

## File Structure

- Modify `web/src/lib/account-data-state.ts`: add pure mock-state credit adjustment helper and result type.
- Modify `web/src/lib/server/account-data-store.ts`: export `adjustAdminUserCredits` and add mock/Supabase implementations.
- Modify `web/src/lib/server/account-data-store.test.ts`: add failing tests for balance adjustments and validation.
- Create `web/src/app/api/admin/users/[userId]/credits/route.ts`: admin-only PATCH route.
- Create `web/src/components/admin/user-credit-editor.tsx`: client-side admin table and save controls.
- Modify `web/src/app/admin/page.tsx`: replace the static user account table with the editor.
- Modify `web/src/app/globals.css`: add compact styles for the user credit editor.
- Modify `web/package.json`: include any new test file only if one is added; current plan adds tests to an existing listed test file.

### Task 1: Core Credit Adjustment

**Files:**
- Modify: `web/src/lib/account-data-state.ts`
- Modify: `web/src/lib/server/account-data-store.ts`
- Test: `web/src/lib/server/account-data-store.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests asserting positive adjustment, negative clamp, and validation failures:

```ts
test("adjustUserCreditsInState applies signed admin deltas and keeps balances nonnegative", () => {
  const state = createMockAccountDataState({ users: [account], pets: [], assets: [] });

  const added = adjustUserCreditsInState(state, {
    userId: account.id,
    amount: 100,
    reason: "客服补偿"
  });
  const deducted = adjustUserCreditsInState(state, {
    userId: account.id,
    amount: -20000,
    reason: "异常扣回"
  });

  assert.equal(added.previousBalance, 10120);
  assert.equal(added.balance, 10220);
  assert.equal(added.amount, 100);
  assert.equal(added.reason, "客服补偿");
  assert.equal(deducted.previousBalance, 10220);
  assert.equal(deducted.balance, 0);
  assert.equal(state.users[0]?.credits, 0);
});

test("adjustUserCreditsInState validates user, amount, and reason", () => {
  const state = createMockAccountDataState({ users: [account], pets: [], assets: [] });

  assert.throws(
    () => adjustUserCreditsInState(state, { userId: "missing", amount: 10, reason: "补偿" }),
    /USER_NOT_FOUND/
  );
  assert.throws(
    () => adjustUserCreditsInState(state, { userId: account.id, amount: 0, reason: "补偿" }),
    /CREDIT_ADJUSTMENT_AMOUNT_REQUIRED/
  );
  assert.throws(
    () => adjustUserCreditsInState(state, { userId: account.id, amount: 10, reason: "   " }),
    /CREDIT_ADJUSTMENT_REASON_REQUIRED/
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/server/account-data-store.test.ts`

Expected: FAIL because `adjustUserCreditsInState` is not exported.

- [ ] **Step 3: Implement mock and server helpers**

Add an `AdminCreditAdjustmentResult` type and `adjustUserCreditsInState` to `account-data-state.ts`. Export `adjustAdminUserCredits` from `account-data-store.ts`; in mock mode delegate to the pure helper, and in Supabase mode read/upsert `credit_balances` and insert `credit_ledger`.

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/lib/server/account-data-store.test.ts`

Expected: PASS for the new tests and existing account data store tests.

### Task 2: Admin API Route

**Files:**
- Create: `web/src/app/api/admin/users/[userId]/credits/route.ts`

- [ ] **Step 1: Add route**

Create a `PATCH` handler that checks `getCurrentAuthContext()`, rejects non-admin requests with existing `AUTH_REQUIRED` / `ADMIN_REQUIRED` conventions, validates `{ amount, reason }` with zod, calls `adjustAdminUserCredits`, maps `USER_NOT_FOUND` to 404, and returns the adjustment result.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`

Expected: no TypeScript errors for the new route.

### Task 3: Admin UI

**Files:**
- Create: `web/src/components/admin/user-credit-editor.tsx`
- Modify: `web/src/app/admin/page.tsx`
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Add client editor**

Create a client component that renders each admin user row with amount and reason inputs. On save, send a PATCH request to `/api/admin/users/${user.id}/credits`, update the row balance from the response, clear inputs, and show row-local save status.

- [ ] **Step 2: Wire admin page**

Replace the static "用户账号" `DataTable` with `UserCreditEditor users={overview.users}`.

- [ ] **Step 3: Add styles**

Add compact table/input/action styles that match the existing admin table and button conventions.

- [ ] **Step 4: Verify**

Run: `npm run lint` and `npm test`.

Expected: TypeScript passes and the unit suite passes.

