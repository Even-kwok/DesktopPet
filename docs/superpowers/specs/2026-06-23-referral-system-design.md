# Referral System Design

## Goal

Build the first referral infrastructure for email-based registration, admin-issued referral codes, first-recharge discounts, and independent referral reward evidence. This version does not connect a real payment provider. It gives operations a manual recharge path now and leaves one service-level hook for future payment callbacks.

## Scope

This branch implements:

- Optional referral code entry on email registration.
- Admin-created referral codes for already registered users.
- One-time registration attribution from a referred user to a referral code owner.
- Admin-editable referral settings:
  - Referral owner reward percent, default `10`.
  - Referred user's first-recharge discount percent, default `20`.
- Admin manual recharge recording.
- Automatic referral reward ledger entries when a referred user's recharge is recorded as `paid`.
- User-facing referral summary with personal code, referred count, and independent referral reward total.
- Admin-facing referral distribution section with settings, codes, recharge records, and reward ledger.

This branch does not implement:

- Real checkout, payment capture, payment provider callbacks, invoices, or refunds.
- Cash withdrawal.
- Converting referral rewards into normal spendable credits.
- User self-service referral code applications.
- Multi-level referral networks.

## Product Rules

Referral codes are controlled by admins. A code can only belong to an existing registered user. The first version supports manually creating and enabling or disabling codes from the admin page.

A new user may enter a referral code during email registration. If a referral code is present, it must be valid and active. Invalid or disabled codes block registration with a clear error. If no referral code is entered, registration proceeds normally.

Each referred user can have at most one referral attribution. The attribution is written after Supabase Auth sign-up succeeds and account provisioning succeeds. The attribution stores the reward and discount percentages active at registration time so future setting changes do not rewrite historical registration promises.

The referred user's discount is a first-recharge discount only. Since real payments are not implemented, this version records the discount percent and amount on admin-entered recharge records. Future checkout can reuse the same settings and attribution data to calculate payable price before payment.

Referral owner rewards are independent evidence entries, not normal spendable credits. The owner can see accumulated referral reward value after login. Admins can use this ledger as the company's payable promotion evidence for bloggers or other distributors.

## Data Model

### `app_settings`

Reuse the existing settings table with a new key:

- `referral_settings`

The stored JSON shape is:

```json
{
  "rewardPercent": 10,
  "firstRechargeDiscountPercent": 20
}
```

Values are normalized to safe integer percentages from `0` to `100`.

### `referral_codes`

Create a new table for admin-managed referral codes.

- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `owner_user_id uuid not null references public.profiles(id) on delete cascade`
- `status text not null default 'active' check (status in ('active', 'disabled'))`
- `created_by_user_id uuid references public.profiles(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Codes are stored uppercase after trimming whitespace. The first version validates codes with letters, numbers, underscore, and hyphen, between 4 and 32 characters.

### `user_referrals`

Create a new table for immutable registration attribution.

- `referred_user_id uuid primary key references public.profiles(id) on delete cascade`
- `referral_code_id uuid not null references public.referral_codes(id) on delete restrict`
- `referrer_user_id uuid not null references public.profiles(id) on delete cascade`
- `registered_at timestamptz not null default now()`
- `reward_percent_at_registration integer not null check (reward_percent_at_registration between 0 and 100)`
- `first_recharge_discount_percent_at_registration integer not null check (first_recharge_discount_percent_at_registration between 0 and 100)`
- `first_recharge_discount_used_at timestamptz`

The primary key prevents a user from being attributed to multiple referrers.

### `referral_reward_ledger`

Create a new table for independent reward evidence.

- `id uuid primary key default gen_random_uuid()`
- `referrer_user_id uuid not null references public.profiles(id) on delete cascade`
- `referred_user_id uuid not null references public.profiles(id) on delete cascade`
- `referral_code_id uuid not null references public.referral_codes(id) on delete restrict`
- `recharge_record_id uuid not null references public.recharge_records(id) on delete restrict`
- `amount_cents integer not null check (amount_cents >= 0)`
- `currency text not null default 'CNY'`
- `reward_percent integer not null check (reward_percent between 0 and 100)`
- `reward_amount_cents integer not null check (reward_amount_cents >= 0)`
- `reward_credits integer not null check (reward_credits >= 0)`
- `status text not null default 'posted' check (status in ('posted', 'voided'))`
- `created_at timestamptz not null default now()`
- `unique (recharge_record_id)`

`reward_amount_cents` is calculated from actual paid recharge amount. `reward_credits` is the display-friendly integer value derived from the same reward amount. This keeps the first version simple while preserving the money-based calculation needed for distribution evidence.

### `recharge_records`

Extend the existing table:

- `discount_percent integer not null default 0 check (discount_percent between 0 and 100)`
- `discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0)`
- `referral_code_id uuid references public.referral_codes(id) on delete set null`
- `referred_by_user_id uuid references public.profiles(id) on delete set null`
- `paid_at timestamptz`
- `note text`

Manual admin recharge entries write these fields. Future payment callbacks can write the same fields and call the same reward-posting service.

## Mock State

Local preview mode mirrors the production shapes with in-memory state:

- Referral settings.
- Referral codes.
- User referral attributions.
- Recharge records.
- Referral reward ledger.

Mock data should include one active referral code for the demo user and at least one paid recharge example so the admin and user surfaces have realistic content.

## Server Architecture

Create a small referral domain module focused on pure rules:

- Normalize referral settings.
- Normalize and validate codes.
- Calculate first-recharge discount amount.
- Calculate reward amount and display credits.
- Summarize owner referral stats.

Create a server store module for persistence:

- `loadReferralSettings`
- `saveReferralSettings`
- `listAdminReferralCodes`
- `createAdminReferralCode`
- `updateAdminReferralCodeStatus`
- `resolveActiveReferralCode`
- `recordUserReferralAtRegistration`
- `loadAccountReferralSummary`
- `recordAdminRecharge`
- `postReferralRewardForRecharge`
- `listAdminReferralRewards`

The recharge service is the single entry point that both admin manual recharge and future payment callbacks should use. It inserts or updates the recharge record, applies normal credit balance changes for paid records, then posts one referral reward if the user has referral attribution and no reward exists for that recharge.

## Registration Flow

The signed-out home registration form adds an optional `referralCode` input.

`POST /api/auth/register` changes as follows:

1. Parse email, password, next path, and optional referral code.
2. If a referral code was supplied, resolve it before creating the auth user.
3. If the code is missing, disabled, or belongs to an invalid owner, redirect with an error.
4. Create the Supabase Auth user.
5. Provision profile, credit balance, and starter pet.
6. If a referral code was supplied, write `user_referrals` with current referral settings.
7. Redirect as the current route does today.

Mock mode accepts the optional code against mock referral state. It still signs in the demo user for preview, but the validation path is exercised so local tests and previews match production behavior.

## Admin Flow

The admin page gains a "推荐分销" section.

Controls:

- Settings editor for reward percent and first-recharge discount percent.
- Referral code creation form:
  - Owner user selector or owner email input.
  - Referral code input.
  - Create button.
- Referral code table:
  - Code.
  - Owner display name and email.
  - Status.
  - Referred user count.
  - Posted reward total.
  - Enable or disable action.
- Manual recharge form:
  - User selector or email input.
  - Amount in CNY cents or yuan field normalized server-side.
  - Credits granted.
  - Status.
  - Note.
  - Save button.
- Referral reward ledger table:
  - Referrer.
  - Referred user.
  - Recharge amount.
  - Reward percent.
  - Reward amount.
  - Status.
  - Created time.

Admin APIs remain server-authorized with `getCurrentAuthContext()` and `auth.isAdmin`.

## User Flow

The logged-in studio billing panel gains a compact referral summary.

It shows:

- The user's active referral code when one exists.
- How many users registered with that user's code.
- Total posted referral reward value.
- A note that referral rewards are promotion evidence for now and are not withdrawable or spendable credits yet.
- The first-recharge discount offered to new users who register with the code.

Users without a referral code see a short message saying referral codes are opened by admin approval.

## Reward And Discount Calculations

For a paid recharge:

```text
discount_amount_cents = floor(amount_cents * discount_percent / 100)
reward_amount_cents = floor(amount_cents * reward_percent / 100)
reward_credits = floor(reward_amount_cents / 100)
```

The reward is based on recharge amount, not granted credits. This matches the product goal of using the ledger as distribution and promotion expense evidence.

The first-recharge discount is only marked used on the referred user's first paid recharge. Later recharges can still post referrer rewards if the business wants ongoing revenue share. For this first version, referrer reward applies to every paid recharge by a referred user, while the referred user's discount applies only once.

## Security And Consistency

Production Supabase access uses service role only from server routes and server stores. Browser and desktop clients never receive service role credentials.

RLS must be enabled for the new tables. Authenticated users may read only their own referral summary data and their own reward totals where they are the referrer. Admin routes use server-side service role queries for full tables.

Idempotency is required for reward posting. The unique constraint on `referral_reward_ledger.recharge_record_id` prevents duplicate rewards if a recharge is saved twice or a future payment callback retries.

Referral attribution must not allow self-referral. If the resolved referral code owner is the same user as the newly registered account, the registration handler returns a referral attribution error before writing `user_referrals`. Since referral code owners are existing users and duplicate-email sign-up fails first, this mainly protects service-level reuse and future auth flows.

## Error Handling

Registration returns user-friendly redirect messages:

- Missing email or password.
- Password shorter than 6 characters.
- Referral code invalid or disabled.
- Registration failed because the email already exists.
- Account created but provisioning failed.
- Account created but referral attribution failed.

Admin APIs return JSON errors:

- `AUTH_REQUIRED`
- `ADMIN_REQUIRED`
- `INVALID_REFERRAL_SETTINGS`
- `REFERRAL_CODE_REQUIRED`
- `REFERRAL_CODE_INVALID`
- `REFERRAL_CODE_EXISTS`
- `REFERRAL_OWNER_NOT_FOUND`
- `USER_NOT_FOUND`
- `INVALID_RECHARGE_RECORD`
- `RECHARGE_RECORD_FAILED`

## Testing

Unit tests should cover pure referral rules:

- Settings normalization clamps invalid values to defaults or allowed ranges.
- Code normalization uppercases valid codes and rejects invalid codes.
- First-recharge discount amount is calculated from amount cents.
- Reward amount and reward credits are calculated from amount cents.

Mock state tests should cover:

- Creating a referral code for an existing user.
- Rejecting duplicate codes.
- Recording attribution for a referred user.
- Rejecting invalid or disabled codes.
- Paid manual recharge posts a referral reward exactly once.
- Non-paid manual recharge does not post a reward.
- First-recharge discount is marked used only once.
- Referral rewards do not change normal credit balance.

API or component-level tests should cover:

- Registration includes optional referral code field in the signed-out home form.
- Admin referral settings editor can save valid values.
- Admin recharge recording updates the displayed recharge and reward rows.
- Studio referral summary shows code, referred count, and reward total.

Existing tests for registration, admin overview, credit adjustment, and studio bootstrap should continue to pass.
