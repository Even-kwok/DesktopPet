# Account Sync Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable account sync protocol, Mac placeholder login flow, and admin data-management contract for users, pets, materials, credits, recharge records, friends, hosting, and material-library slots.

**Architecture:** Keep the existing web studio and native studio intact, but introduce typed contract builders around the sync/admin data. The Mac app stores a lightweight local account session, fetches the extended desktop bundle, downloads ready videos, and keeps local imports available for testing.

**Tech Stack:** Swift 5.9, SwiftUI/AppKit, XCTest, Next.js App Router, TypeScript, node:test, Supabase schema draft.

---

### Task 1: Web Contract Types And Bundle Builder

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/mock-data.ts`
- Modify: `web/src/lib/desktop-bundle.ts`
- Modify: `web/src/lib/desktop-bundle.test.ts`

- [ ] Add a failing TypeScript test proving `buildDesktopPetBundle` exports account metadata, pet numbers, ownership fields, and only ready materials with URLs.
- [ ] Run `npm run test:unit` from `web`; expected failure references missing `account`, `petNumber`, or ownership fields.
- [ ] Extend shared types with `AccountSyncSummary`, `PetOwnership`, and extended `DesktopPetBundlePet`.
- [ ] Update mock pets with `petNumber`, `ownerUserId`, `currentHostUserId`, and ownership/location fields.
- [ ] Update `buildDesktopPetBundle` to include account and ownership metadata.
- [ ] Run `npm run test:unit`; expected pass.

### Task 2: Admin Overview Contract

**Files:**
- Create: `web/src/lib/admin-overview.ts`
- Create: `web/src/lib/admin-overview.test.ts`
- Create: `web/src/app/api/admin/overview/route.ts`
- Modify: `web/package.json`

- [ ] Add a failing test for `buildAdminOverview` covering users, pets, materials, credits, recharge records, friendships, hosting requests, and material-library slots.
- [ ] Run the admin overview test directly with `node --experimental-strip-types --test src/lib/admin-overview.test.ts`; expected failure is missing module.
- [ ] Implement typed admin overview data using existing mock data plus small mock recharge/ledger records.
- [ ] Add `GET /api/admin/overview` that returns the overview JSON.
- [ ] Add the admin test to `test:unit`.
- [ ] Run `npm run test:unit`; expected pass.

### Task 3: Mac Account Session And Sync Decoding

**Files:**
- Create: `Sources/CatDesktopPet/DesktopAccountSessionStore.swift`
- Modify: `Sources/CatDesktopPet/DesktopPetSyncClient.swift`
- Modify: `Tests/CatDesktopPetTests/DesktopPetSyncClientTests.swift`
- Create: `Tests/CatDesktopPetTests/DesktopAccountSessionStoreTests.swift`

- [ ] Add Swift tests for decoding the extended sync bundle and persisting/clearing a mock account session.
- [ ] Run `swift test`; expected failure references missing account session store or extended decoded fields.
- [ ] Implement `DesktopAccountSessionStore` with mock login, sign out, and persisted account summary.
- [ ] Extend Swift decodable sync models for account, pet number, ownership, owner/host ids, and sync metadata.
- [ ] Keep `importLatestBundle` behavior local-file based and compatible with older bundle fields where possible.
- [ ] Run `swift test`; expected pass.

### Task 4: Native Studio Placeholder Login UI

**Files:**
- Modify: `Sources/CatDesktopPet/PetStudioViewModel.swift`
- Modify: `Sources/CatDesktopPet/PetStudioView.swift`
- Modify: `Sources/CatDesktopPet/PetStudioWindowController.swift`

- [ ] Add view model state for signed-in account, sync label, mock login, sign out, and account-gated sync.
- [ ] Update the studio header/sidebar with account status, mock login, sync, and sign-out controls.
- [ ] Preserve local image upload and local MP4/MOV import buttons.
- [ ] Run `swift test`; expected pass.

### Task 5: Supabase Schema And Planning Docs

**Files:**
- Modify: `docs/schema.sql`
- Modify: `docs/deployment.md`
- Modify: `README.md`
- Modify: `web/README.md`

- [ ] Expand schema with pet numbers, account status, credit balances, recharge records, grouped material slot definitions, admin-editable prompt templates, public prompt-free projections, generation settings snapshots, explicit grants, and RLS policy notes.
- [ ] Update docs to explain desktop account sync, placeholder login, admin-management domains, and local素材 import preservation.
- [ ] Run `npm run test:unit` and `swift test`; expected pass.

### Task 6: Final Verification

**Files:**
- All touched files.

- [ ] Run `npm run test:unit` from `web`.
- [ ] Run `npm run lint` from `web`.
- [ ] Run `swift test` from the project root.
- [ ] Review `git diff --stat` and `git diff --check`.
- [ ] Report any verification failures honestly with command output.
