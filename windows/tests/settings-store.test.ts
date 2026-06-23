import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SettingsStore } from "../src/shared/settings-store.ts";

function makeStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-windows-"));
  const store = new SettingsStore(path.join(dir, "settings.json"));
  return {
    store,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
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

test("persists pet names, size, frame, video paths, and session", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 2;
    store.setPetName("栗子", 0);
    store.setPetName("团子", 1);
    store.setPetSizeScale(0.1, 0);
    store.setPetFrame({ x: 12, y: 34, width: 45, height: 67 }, 0);
    store.saveVideoPath("C:/cats/idle.mp4", "idle_loop", 0);
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
    assert.equal(reloaded.restoreVideoPath("idle_loop", 0), "C:/cats/idle.mp4");
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
    store.saveVideoPath("C:/cats/first.mp4", "idle_loop", 0);
    store.saveVideoPath("C:/cats/second.mp4", "idle_loop", 1);

    store.removePet(0);

    assert.equal(store.petCount, 1);
    assert.equal(store.petName(0), "团子");
    assert.equal(store.petSizeScale(0), 0.3);
    assert.equal(store.restoreVideoPath("idle_loop", 0), "C:/cats/second.mp4");
    assert.equal(store.restoreVideoPath("idle_loop", 1), undefined);
  } finally {
    cleanup();
  }
});
