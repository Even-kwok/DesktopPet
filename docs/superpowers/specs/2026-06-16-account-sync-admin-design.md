# Account Sync And Admin Design

## Goal

Build the first account sync contract between the web studio and the Mac app, then prepare the data model needed for the future admin dashboard. This branch keeps local Mac video import for desktop testing, while making cloud-owned pets and materials the primary future path.

## Product Scope

This branch implements three layers:

- Desktop account placeholder: the Mac app opens to a lightweight login/sync state, stores a mock signed-in account locally, and can sync that account's pets from the web bundle endpoint.
- Account sync protocol: web bundle data includes stable account, ownership, hosting, pet numbering, and material metadata that a desktop client can cache and run locally.
- Admin data planning: schema and mock admin API data cover users, pets, pet materials, credits, recharge records, friendships, hosting requests, and material-library slot configuration.

This branch does not implement real Supabase Auth sign-in, payment capture, production RLS rollout, or a polished admin dashboard. It prepares the interfaces so those pieces can be added without changing the desktop sync shape again.

## Data Model

Use UUIDs as primary keys. Give every pet a separate human-readable `pet_number` for support/admin workflows, such as `CAT-20260616-0001`. The pet UUID remains the system identifier; `pet_number` is searchable and unique.

Core ownership fields:

- `profiles.id`: auth user id.
- `pets.owner_user_id`: permanent owner account.
- `pets.current_host_user_id`: account currently displaying the pet, when the pet is hosted by a friend.
- `pets.location_status`: `at_owner_desktop`, `hosted_by_friend`, `away`, or later moderation states.

Admin-managed domains:

- Accounts: profile, email mirror, display name, avatar, account status, created time.
- Pets: pet number, owner, current host, name, species, status, image URLs, bundle URL.
- Materials: per-pet material code identifier, status, video URL, provider job linkage, generation settings snapshot, and server-side prompt snapshot.
- Credits: current balance plus append-only ledger.
- Recharge records: payment provider, amount, credits granted, status, external transaction id.
- Friends: friend requests and accepted friendships.
- Hosting: pet hosting requests, accept/decline/return lifecycle.
- Material library: Chinese material names, code identifiers, grouping with purpose text, client-fixed trigger labels, duration-based credit rules, admin-editable full prompt templates, generation defaults, enabled flag.

## Desktop Sync Contract

`GET /api/desktop/pets` returns a `DesktopAccountSyncBundle`:

- `version`: protocol version.
- `generatedAt`: ISO timestamp.
- `account`: signed-in account summary, nullable in mock mode.
- `sync`: mode, source, and next recommended poll interval.
- `pets`: only pets the current desktop account should display or manage.

Each synced pet includes:

- `id`: pet UUID.
- `petNumber`: admin/support visible pet number.
- `ownerUserId`: owning account id.
- `currentHostUserId`: active host account id if any.
- `ownership`: `owned`, `hosted`, or `away`.
- `displayState`: `active`, `hidden`, or `unavailable`.
- `materials`: ready video materials with slot, label, URL, status, updated time.

The Mac app downloads ready videos into Application Support, registers the local file paths in `SettingsStore`, and then the existing state machine runs from local files. If no cloud account is signed in, the app stays usable with locally imported videos.

## Desktop Login Placeholder

The first Mac UI is a placeholder account panel:

- A "mock login" button stores a local desktop account using demo profile values.
- A "sync web pets" button pulls the bundle for the current account.
- A "sign out" button clears the local account only, leaving local videos untouched.
- The existing status-bar "选择状态视频" and studio card "导入" controls stay visible for testing local desktop behavior.

When real auth is added later, this placeholder should be replaced by a token/session provider without changing `DesktopPetSyncClient.importLatestBundle`.

## Web/Admin Shape

Add mock admin data and an internal API route:

- `GET /api/admin/overview`
- Returns users, pets, materials, credit balances, recharge records, friendships, hosting requests, and material slot definitions.

This route is mock-only for now. It documents the management data needed by the future admin page and gives the frontend/backend a typed contract to build against.

## Security Notes

Supabase Auth uses JWTs that integrate with RLS for row-level authorization, so production routes must re-check the authenticated user server-side before returning account data. Supabase's 2026 Data API grant change means new public tables should include explicit grants in migrations, plus RLS policies. Service role keys must stay server-only and must never be exposed in Mac or browser clients.

## Testing

- TypeScript unit tests cover the desktop bundle contract and admin overview builder.
- Swift unit tests cover decoding the extended bundle and account session persistence.
- Existing web unit tests continue to pass.
- `swift test` verifies the Mac package still compiles after adding account sync models.
