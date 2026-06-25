import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  refreshedAccountSessionFromSyncAccount,
  SettingsStore
} from "../src/shared/settings-store.ts";
import type { PetActionSlot } from "../src/shared/pet-action-slots.ts";

function makeStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-windows-"));
  const store = new SettingsStore(path.join(dir, "settings.json"));
  return {
    store,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function saveVideoFile(store: SettingsStore, fileName: string, slot: PetActionSlot = "idle_loop", index = 0) {
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

test("does not keep paused friend and hosting caches in persisted Windows settings", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/shared/settings-store.ts"),
    "utf8"
  );

  assert.doesNotMatch(source, /friendCards/);
  assert.doesNotMatch(source, /hostingRequests/);
  assert.doesNotMatch(source, /DesktopFriend/);
  assert.doesNotMatch(source, /DesktopHosting/);
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

test("falls back to Mac defaults when the settings file is not valid JSON", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(store.filePath, "{not valid json");

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
        selectedSyncedPetID: 42
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.currentAccount, undefined);
    assert.deepEqual(reloaded.syncedPetCards, []);
    assert.equal(reloaded.selectedSyncedPetID, undefined);
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
          },
          {
            id: "pet_negative",
            petNumber: "P3",
            name: "负数缓存",
            ownership: "owned",
            displayState: "active",
            materialCount: -1
          }
        ]
      })
    );

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.currentAccount, undefined);
    assert.deepEqual(
      reloaded.syncedPetCards.map((card) => card.id),
      ["pet_orange"]
    );
  } finally {
    cleanup();
  }
});

test("filters cached studio cards with empty identity fields", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
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
            id: "   ",
            petNumber: "P2",
            name: "空白 ID",
            ownership: "owned",
            displayState: "active",
            materialCount: 1
          },
          {
            id: "pet_blank_name",
            petNumber: "P3",
            name: "",
            ownership: "owned",
            displayState: "active",
            materialCount: 1
          }
        ]
      })
    );

    const reloaded = new SettingsStore(store.filePath);

    assert.deepEqual(
      reloaded.syncedPetCards.map((card) => card.id),
      ["pet_orange"]
    );
  } finally {
    cleanup();
  }
});

test("filters cached account sessions with empty access tokens", () => {
  const { store, cleanup } = makeStore();
  try {
    writeFileSync(
      store.filePath,
      JSON.stringify({
        currentAccount: {
          id: "user_demo",
          name: "栗子主人",
          email: "demo@desktop.pet",
          credits: 120,
          accessToken: "   ",
          signedInAt: "2026-06-24T00:00:00.000Z"
        }
      })
    );

    const reloaded = new SettingsStore(store.filePath);

    assert.equal(reloaded.currentAccount, undefined);
  } finally {
    cleanup();
  }
});

test("filters cached account sessions with empty identity fields", () => {
  const malformedAccounts = [
    { id: " ", name: "栗子主人", email: "demo@desktop.pet", signedInAt: "2026-06-24T00:00:00.000Z" },
    { id: "user_demo", name: " ", email: "demo@desktop.pet", signedInAt: "2026-06-24T00:00:00.000Z" },
    { id: "user_demo", name: "栗子主人", email: " ", signedInAt: "2026-06-24T00:00:00.000Z" },
    { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", signedInAt: " " }
  ];

  for (const account of malformedAccounts) {
    const { store, cleanup } = makeStore();
    try {
      writeFileSync(
        store.filePath,
        JSON.stringify({
          currentAccount: {
            ...account,
            credits: 120,
            accessToken: "desktop-token"
          }
        })
      );

      const reloaded = new SettingsStore(store.filePath);
      assert.equal(reloaded.currentAccount, undefined);
    } finally {
      cleanup();
    }
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

test("ignores invalid pet indexes when removing pets", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 2;
    store.setPetName("栗子", 0);
    store.setPetName("团子", 1);

    store.removePet(Number.NaN);

    assert.equal(store.petCount, 2);
    assert.equal(store.petName(0), "栗子");
    assert.equal(store.petName(1), "团子");
  } finally {
    cleanup();
  }
});

test("ignores out-of-range pet writes without expanding persisted pet data", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;
    const ghostVideoPath = path.join(path.dirname(store.filePath), "ghost.mp4");
    writeFileSync(ghostVideoPath, "");

    store.setPetName("Ghost", 999);
    store.setPetSizeScale(0.5, 999);
    store.setPetFrame({ x: 1, y: 2, width: 150, height: 150 }, 999);
    store.saveVideoPath(ghostVideoPath, "click_react", 999);
    store.removeVideo("idle_loop", 999);

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: unknown[];
    };
    const reloaded = new SettingsStore(store.filePath);

    assert.equal(reloaded.petCount, 1);
    assert.equal(reloaded.petName(0), "Pet 1");
    assert.deepEqual(reloaded.savedVideoSlots(0), []);
    assert.ok((persisted.pets?.length ?? 0) <= 1);
  } finally {
    cleanup();
  }
});

test("reads out-of-range pet data without expanding later persisted pet data", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;

    assert.equal(store.petName(999), "Pet 1000");
    assert.equal(store.petSizeScale(999), 1);
    assert.equal(store.restoreVideoPath("idle_loop", 999), undefined);
    assert.deepEqual(store.savedVideoSlots(999), []);
    assert.deepEqual(store.petFrame(999, { width: 1024, height: 768 }), {
      x: 539,
      y: -5335,
      width: 150,
      height: 150
    });

    store.isPetVisible = true;

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: unknown[];
    };

    assert.ok((persisted.pets?.length ?? 0) <= 1);
  } finally {
    cleanup();
  }
});

test("uses safe first-pet defaults for invalid JavaScript pet indexes", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;
    store.setPetName("栗子", 0);

    assert.equal(store.petName(Number.NaN), "栗子");
    assert.equal(store.petName(Number.POSITIVE_INFINITY), "栗子");
    assert.equal(store.petName(-1), "栗子");
    assert.deepEqual(store.petFrame(Number.NaN, { width: 1024, height: 768 }), {
      x: 437,
      y: 309,
      width: 150,
      height: 150
    });

    store.isPetVisible = true;

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: unknown[];
    };

    assert.ok((persisted.pets?.length ?? 0) <= 1);
  } finally {
    cleanup();
  }
});

test("does not save videos for inactive future pet slots", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;
    const futureVideoPath = path.join(path.dirname(store.filePath), "future-click.mp4");
    writeFileSync(futureVideoPath, "");

    store.saveVideoPath(futureVideoPath, "click_react", 1);
    store.removeVideo("click_react", 1);
    store.isPetVisible = true;

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: Array<{ videos?: Record<string, string> }>;
    };

    assert.equal(store.restoreVideoPath("click_react", 1), undefined);
    assert.deepEqual(store.savedVideoSlots(1), []);
    assert.equal(persisted.pets?.[1]?.videos, undefined);
  } finally {
    cleanup();
  }
});

test("does not persist blank video paths or overwrite existing videos with blanks", () => {
  const { store, cleanup } = makeStore();
  try {
    store.saveVideoPath("   ", "idle_loop", 0);
    assert.deepEqual(store.savedVideoSlots(0), []);

    const idlePath = saveVideoFile(store, "idle.mp4", "idle_loop", 0);
    store.saveVideoPath("", "idle_loop", 0);
    store.saveVideoPath("\n\t", "click_react", 0);

    assert.equal(store.restoreVideoPath("idle_loop", 0), idlePath);
    assert.deepEqual(store.savedVideoSlots(0), ["idle_loop"]);
  } finally {
    cleanup();
  }
});

test("does not save pet names for the inactive boundary slot", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;

    store.setPetName("Ghost", 1);
    store.isPetVisible = true;

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: Array<{ name?: string }>;
    };

    assert.equal(store.petName(1), "Pet 2");
    assert.equal(persisted.pets?.[1]?.name, undefined);
  } finally {
    cleanup();
  }
});

test("does not save pet size or frame for the inactive boundary slot", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;

    store.setPetSizeScale(0.5, 1);
    store.setPetFrame({ x: 1, y: 2, width: 75, height: 75 }, 1);
    store.isPetVisible = true;

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: Array<{ sizeScale?: number; frame?: unknown }>;
    };

    assert.equal(store.petSizeScale(1), 1);
    assert.equal(persisted.pets?.[1]?.sizeScale, undefined);
    assert.equal(persisted.pets?.[1]?.frame, undefined);
  } finally {
    cleanup();
  }
});

test("does not overwrite valid pet frames with malformed frame writes", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 1;
    const validFrame = { x: 12, y: 34, width: 150, height: 150 };
    store.setPetFrame(validFrame, 0);

    store.setPetFrame({ x: Number.NaN, y: 99, width: 150, height: 150 }, 0);
    store.setPetFrame({ x: 20, y: 99, width: Number.POSITIVE_INFINITY, height: 150 }, 0);
    store.setPetFrame({ x: 20, y: 99, width: 0, height: 150 }, 0);

    const persisted = JSON.parse(readFileSync(store.filePath, "utf8")) as {
      pets?: Array<{ frame?: unknown }>;
    };

    assert.deepEqual(store.petFrame(0), validFrame);
    assert.deepEqual(persisted.pets?.[0]?.frame, validFrame);
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
    assert.deepEqual(store.availableVideoSlots(0), []);
  } finally {
    cleanup();
  }
});

test("lists only restorable video slots for Studio display", () => {
  const { store, cleanup } = makeStore();
  try {
    saveVideoFile(store, "idle.mp4", "idle_loop", 0);
    store.saveVideoPath(path.join(path.dirname(store.filePath), "missing.mp4"), "click_react", 0);

    assert.deepEqual(store.savedVideoSlots(0), ["idle_loop", "click_react"]);
    assert.deepEqual(store.availableVideoSlots(0), ["idle_loop"]);
  } finally {
    cleanup();
  }
});

test("lists restorable video paths for Studio preview", () => {
  const { store, cleanup } = makeStore();
  try {
    const idlePath = saveVideoFile(store, "idle.mp4", "idle_loop", 0);
    const clickPath = saveVideoFile(store, "click.mp4", "click_react", 0);
    store.saveVideoPath(path.join(path.dirname(store.filePath), "missing.mp4"), "sleep_loop", 0);

    assert.deepEqual(store.availableVideoPaths(0), {
      idle_loop: idlePath,
      click_react: clickPath
    });
  } finally {
    cleanup();
  }
});

test("persists synced pet cards separately from account session", () => {
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
    store.signOut();

    const reloaded = new SettingsStore(store.filePath);
    assert.equal(reloaded.currentAccount, undefined);
    assert.equal(reloaded.syncedPetCards[0]?.name, "栗子");
    assert.equal(reloaded.selectedSyncedPetID, "pet_orange");

    reloaded.markSyncedPetRecalled("pet_orange");
    assert.equal(reloaded.syncedPetCards[0]?.displayState, "active");
    assert.equal(reloaded.syncedPetCards[0]?.ownership, "owned");
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
