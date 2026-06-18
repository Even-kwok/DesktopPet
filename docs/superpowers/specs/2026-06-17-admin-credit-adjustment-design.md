# Admin Credit Adjustment Design

## Goal

Give admin users a controlled way to adjust a user's credit balance by entering a signed delta such as `+100` or `-50`, while recording the reason for the adjustment in the credit ledger.

## Scope

- Add credit adjustment controls to the existing admin user account section.
- Add an admin-only API route for applying credit deltas.
- Support both local mock mode and Supabase mode.
- Keep balances nonnegative.
- Record each Supabase adjustment in `credit_ledger`.

## Architecture

The admin page remains a server component. A small client component owns the per-user adjustment form and calls a new admin API route. The API route performs admin authorization and request validation, then delegates balance mutation to the account data store.

The account data store exposes one function, `adjustAdminUserCredits`, with mock and Supabase implementations. Mock mode updates `mockAccountState.users[].credits`. Supabase mode reads the current row from `credit_balances`, upserts the new balance, and inserts a ledger row with the signed adjustment amount and a reason prefixed by `管理员调整：`.

## Validation

- `amount` must be a nonzero integer.
- `reason` must be a nonempty trimmed string, capped at 160 characters.
- The target user must exist.
- The resulting balance is clamped to zero when a negative adjustment exceeds the current balance.

## UI

The "用户账号" admin section will show a user credit editor table. Each row displays the account name, email, pet count, consumed credits, material count, current balance, an amount input, a reason input, and a save button. Save state appears inline per row.

## Testing

Tests cover the pure mock state adjustment behavior before production changes:

- Positive deltas increase the balance.
- Negative deltas decrease the balance.
- Negative deltas cannot reduce balance below zero.
- Missing reasons and missing users throw clear errors.

