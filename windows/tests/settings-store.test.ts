import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  refreshedAccountSessionFromSyncAccount,
  SettingsStore
} from "../src/shared/settings-store.ts";

function makeStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-windows-"));
  const store = new SettingsStore(path.join(dir, "settings.json"));
  return {
    store,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function saveVideoFile(store: SettingsStore, fileName: string, slot = "idle_loop" as const, index = 0) {
  const videoPath = path.join(path.dirname(store.filePath), fileName);
  writeFileSync(videoPath, "");
  store.saveVideoPath(videoPath, slot, index);
  return videoPath;
}

test("defaults match Mac desktop behavior", () => {
  const { store, cleanup } = makeStore();
  try {
    assert.equal(store.petCount, 1);
    assert.equal(store.isPetVisible, false);
    assert.equal(store.isClickThrough, false);
    assert.equal(store.isMouseoverCatchEnabled, true);
    assert.equal(store.petName(0), "Pet 1");
    assert.equal(store.petSizeScale(0), 1);
    assert.deepEqual(store.petFrame(0, { width: 1024, height: 768 }), {
      x: 437,
      y: 309,
      width: 150,
      height: 150
    });
  } finally {
    cleanup();
  }
});

test("falls back to Mac defaults for malformed setting values", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        petCount: "many",
        isPetVisible: "yes",
        isClickThrough: "no",
        isMouseoverCatchEnabled: "maybe",
        pets: "invalid"
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.petCount, 1);
    assert.equal(reloaded.isPetVisible, false);
    assert.equal(reloaded.isClickThrough, false);
    assert.equal(reloaded.isMouseoverCatchEnabled, true);
    assert.equal(reloaded.petName(0), "Pet 1");
    assert.deepEqual(reloaded.savedVideoSlots(0), []);
  } finally {
    cleanup();
  }
});

test("falls back to Mac defaults for malformed pet setting records", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        pets: [
          {
            name: 123,
            sizeScale: "large",
            frame: { x: "bad", y: 20, width: 100, height: 100 },
            videos: { idle_loop: 42 }
          }
        ]
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.petName(0), "Pet 1");
    assert.equal(reloaded.petSizeScale(0), 1);
    assert.deepEqual(reloaded.petFrame(0, { width: 1024, height: 768 }), {
      x: 437,
      y: 309,
      width: 150,
      height: 150
    });
    assert.equal(reloaded.restoreVideoPath("idle_loop", 0), undefined);
    assert.deepEqual(reloaded.savedVideoSlots(0), []);
  } finally {
    cleanup();
  }
});

test("falls back to empty account and cache state for malformed studio cache values", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        currentAccount: "signed-in",
        syncedPetCards: "cached-pets",
        selectedSyncedPetID: 42,
        friendCards: "friends"
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.currentAccount, undefined);
    assert.deepEqual(reloaded.syncedPetCards, []);
    assert.equal(reloaded.selectedSyncedPetID, undefined);
    assert.deepEqual(reloaded.friendCards, []);
  } finally {
    cleanup();
  }
});

test("filters malformed account and studio cache records", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        currentAccount: {
          id: "user_demo",
          name: "栗子主人",
          email: "demo@desktop.pet",
          credits: "120",
          accessToken: 123,
          signedInAt: "2026-06-24T00:00:00.000Z"
        },
        syncedPetCards: [
          {
            id: "pet_orange",
            petNumber: "P1",
            name: "栗子",
            ownership: "owned",
            displayState: "active",
            materialCount: 3
          },
          {
            id: "pet_broken",
            petNumber: "P2",
            name: "坏缓存",
            ownership: "owned",
            displayState: "active",
            materialCount: "many"
          }
        ],
        friendCards: [
          { id: "friend_1", name: "阿雯", status: "在线", hostedPets: 1 },
          { id: "friend_broken", name: "坏好友", status: "离线", hostedPets: "none" }
        ]
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.currentAccount, undefined);
    assert.deepEqual(
      reloaded.syncedPetCards.map((card) => card.id),
      ["pet_orange"]
    );
    assert.deepEqual(
      reloaded.friendCards.map((card) => card.id),
      ["friend_1"]
    );
  } finally {
    cleanup();
  }
});

test("falls back to the first synced pet when the cached selection is stale", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        selectedSyncedPetID: "missing_pet",
        syncedPetCards: [
          {
            id: "pet_orange",
            petNumber: "P1",
            name: "栗子",
            ownership: "owned",
            displayState: "active",
            materialCount: 3
          }
        ]
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.selectedSyncedPetID, "pet_orange");
  } finally {
    cleanup();
  }
});

test("persists pet names, size, frame, video paths, and session", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 2;
    store.setPetName("栗子", 0);
    store.setPetName("团子", 1);
    store.setPetSizeScale(0.1, 0);
    store.setPetFrame({ x: 12, y: 34, width: 45, height: 67 }, 0);
    const idlePath = saveVideoFile(store, "idle.mp4");
    store.saveAccountSession({
      id: "user_demo",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 120,
      accessToken: "desktop-token",
      signedInAt: "2026-06-24T00:00:00.000Z"
    });

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.petName(0), "栗子");
    assert.equal(reloaded.petName(1), "团子");
    assert.equal(reloaded.petSizeScale(0), 0.3);
    assert.deepEqual(reloaded.petFrame(0), { x: 12, y: 34, width: 45, height: 67 });
    assert.equal(reloaded.restoreVideoPath("idle_loop", 0), idlePath);
    assert.equal(reloaded.currentAccount?.accessToken, "desktop-token");
  } finally {
    cleanup();
  }
});

test("removing a pet compacts later pet data", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 2;
    store.setPetName("栗子", 0);
    store.setPetName("团子", 1);
    store.setPetSizeScale(0.8, 0);
    store.setPetSizeScale(0.3, 1);
    saveVideoFile(store, "first.mp4", "idle_loop", 0);
    const secondPath = saveVideoFile(store, "second.mp4", "idle_loop", 1);

    store.removePet(0);

    assert.equal(store.petCount, 1);
    assert.equal(store.petName(0), "团子");
    assert.equal(store.petSizeScale(0), 0.3);
    assert.equal(store.restoreVideoPath("idle_loop", 0), secondPath);
    assert.equal(store.restoreVideoPath("idle_loop", 1), undefined);
  } finally {
    cleanup();
  }
});

test("ignores unknown saved video slot keys like the Mac settings store", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        pets: [
          {
            videos: {
              idle_loop: "C:/cats/idle.mp4",
              drag_loop: "C:/cats/drag.mp4",
              unknown_slot: "C:/cats/unknown.mp4"
            }
          }
        ]
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.deepEqual(reloaded.savedVideoSlots(0), ["idle_loop"]);
  } finally {
    cleanup();
  }
});

test("does not restore missing video files while retaining saved slot references", () => {
  const { store, cleanup } = makeStore();
  try {
    store.saveVideoPath(path.join(path.dirname(store.filePath), "missing.mp4"), "idle_loop", 0);

    assert.equal(store.restoreVideoPath("idle_loop", 0), undefined);
    assert.deepEqual(store.savedVideoSlots(0), ["idle_loop"]);
  } finally {
    cleanup();
  }
});

test("persists synced pet cards and friend cards separately from account session", () => {
  const { store, cleanup } = makeStore();
  try {
    store.saveAccountSession({
      id: "user_demo",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 120,
      accessToken: "desktop-token",
      signedInAt: "2026-06-24T00:00:00.000Z"
    });
    store.saveSyncedPetCards([
      {
        id: "pet_orange",
        petNumber: "P1",
        name: "栗子",
        ownership: "away",
        displayState: "unavailable",
        materialCount: 3
      }
    ]);
    store.upsertFriendCard({ id: "friend_1", name: "阿雯", status: "在线", hostedPets: 1 });
    store.signOut();

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.currentAccount, undefined);
    assert.equal(reloaded.syncedPetCards[0]?.name, "栗子");
    assert.equal(reloaded.selectedSyncedPetID, "pet_orange");
    assert.equal(reloaded.friendCards[0]?.name, "阿雯");

    reloaded.markSyncedPetRecalled("pet_orange");
    assert.equal(reloaded.syncedPetCards[0]?.displayState, "active");
    assert.equal(reloaded.syncedPetCards[0]?.ownership, "owned");

    reloaded.removeFriendCard("friend_1");
    assert.deepEqual(reloaded.friendCards, []);
  } finally {
    cleanup();
  }
});

test("refreshes account session from sync account while preserving desktop token", () => {
  const current = {
    id: "old_user",
    name: "旧名字",
    email: "old@example.com",
    credits: 12,
    accessToken: "desktop-token",
    signedInAt: "2026-06-24T00:00:00.000Z"
  };

  assert.deepEqual(
    refreshedAccountSessionFromSyncAccount(current, {
      id: "user_demo",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 88
    }),
    {
      id: "user_demo",
      name: "栗子主人",
      email: "demo@desktop.pet",
      credits: 88,
      accessToken: "desktop-token",
      signedInAt: "2026-06-24T00:00:00.000Z"
    }
  );
  assert.equal(refreshedAccountSessionFromSyncAccount(current, undefined), current);
});
