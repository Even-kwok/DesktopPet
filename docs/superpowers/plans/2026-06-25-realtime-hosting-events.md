# Realtime Hosting Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hosting requests, accept/decline results, and recall actions arrive automatically on Mac and Windows without manual refresh.

**Architecture:** Add a durable per-user `desktop_events` stream on the web backend. Mutations write compact events, desktop clients keep one SSE connection open with their existing bearer token, then fetch authoritative state and sync the desktop when events arrive.

**Tech Stack:** Next.js Route Handlers on Vercel, Supabase Postgres, Electron main process, Swift URLSession streaming, Node test runner, Swift XCTest.

---

### Task 1: Backend Event Model

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/mock-data.ts`
- Modify: `web/src/lib/account-data-state.ts`
- Modify: `web/src/lib/server/account-data-store.ts`
- Modify: `docs/schema.sql`
- Test: `web/src/lib/server/account-data-store.test.ts`

- [ ] Write failing tests proving hosting create, accept, decline, and recall enqueue events for the correct users.
- [ ] Implement `DesktopEvent` storage in mock state and Supabase-backed state.
- [ ] Add `desktop_events` SQL table, RLS policy, authenticated grants, and useful indexes to `docs/schema.sql`.
- [ ] Run `npm run test:unit` in `web`.

### Task 2: Desktop Events API

**Files:**
- Create: `web/src/app/api/desktop/events/route.ts`
- Create: `web/src/app/api/desktop/events/stream/route.ts`
- Test: `web/src/lib/server/desktop-events.test.ts`

- [ ] Write failing tests for event listing and SSE frame formatting.
- [ ] Add `GET /api/desktop/events?after=<cursor>` using existing desktop bearer auth.
- [ ] Add `GET /api/desktop/events/stream?after=<cursor>` that emits pending events, heartbeats, and bounded reconnects.
- [ ] Run `npm run lint` and targeted web tests.

### Task 3: Windows Event Stream

**Files:**
- Create: `windows/src/main/desktop-event-stream.ts`
- Modify: `windows/src/main/app.ts`
- Modify: `windows/src/shared/desktop-sync-client.ts`
- Test: `windows/tests/desktop-event-stream.test.ts`
- Test: `windows/tests/hosting-refresh-policy.test.ts`

- [ ] Write failing tests for SSE parsing, reconnect cursor handling, and hosting event routing.
- [ ] Start the event stream after sign-in and stop it on sign-out.
- [ ] On request/decline events, refresh hosting requests and update Studio.
- [ ] On accepted/recalled/bundle events, run desktop sync once and update pet windows/tray.
- [ ] Keep manual refresh as fallback.

### Task 4: Mac Event Stream

**Files:**
- Create: `Sources/CatDesktopPet/DesktopEventStreamClient.swift`
- Modify: `Sources/CatDesktopPet/DesktopPetSyncClient.swift`
- Modify: `Sources/CatDesktopPet/PetStudioViewModel.swift`
- Test: `Tests/CatDesktopPetTests/DesktopEventStreamClientTests.swift`
- Test: `Tests/CatDesktopPetTests/PetStudioViewModelLayoutTests.swift`

- [ ] Write failing tests for SSE frame parsing and view-model event handling.
- [ ] Start streaming after sign-in and cancel on sign-out/deinit.
- [ ] Refresh hosting requests for request/decline events.
- [ ] Sync desktop bundle for accepted, recalled, and bundle-changed events.
- [ ] Keep manual refresh as fallback.

### Task 5: Faster Accept Sync Feedback

**Files:**
- Modify: `windows/src/main/desktop-bundle-importer.ts`
- Modify: `Sources/CatDesktopPet/DesktopPetSyncClient.swift`
- Test: existing Windows and Swift sync tests

- [ ] Add tests showing cached remote materials are reused when URL-compatible local files already exist.
- [ ] Add progress/status messages during accepted-hosting sync.
- [ ] Run full Windows, web, and Swift verification.
- [ ] Deploy web to Vercel, apply Supabase migration, rebuild/upload Windows ZIP.
