import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PetColonyController } from "../src/main/pet-colony-controller.ts";
import { SettingsStore } from "../src/shared/settings-store.ts";

class FakePetWindow {
  isVisible = false;
  hideCount = 0;
  clickThrough = false;
  sizeScale = 1;
  readonly settingsStore: SettingsStore;
  readonly petIndex: number;

  constructor(settingsStore: SettingsStore, petIndex: number) {
    this.settingsStore = settingsStore;
    this.petIndex = petIndex;
  }

  show() {
    this.isVisible = this.settingsStore.restoreVideoPath("idle_loop", this.petIndex) !== undefined;
    return this.isVisible;
  }

  hide() {
    this.isVisible = false;
    this.hideCount += 1;
  }

  setClickThrough(isClickThrough: boolean) {
    this.clickThrough = isClickThrough;
  }

  setSizeScale(scale: number) {
    this.sizeScale = scale;
  }

  refreshPlayback() {}
  prepareForSystemSleep() {}
  resumeAfterSystemWake() {}
  refreshDisplayName() {}
  resetPosition() {}
}

function makeHarness() {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-colony-"));
  const settingsStore = new SettingsStore(path.join(dir, "settings.json"));
  const windows: FakePetWindow[] = [];
  const colony = new PetColonyController(settingsStore, (petIndex) => {
    const window = new FakePetWindow(settingsStore, petIndex);
    windows.push(window);
    return window;
  });

  return {
    settingsStore,
    colony,
    windows,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("showAll shows only pets with idle_loop videos", () => {
  const { settingsStore, colony, windows, cleanup } = makeHarness();
  try {
    settingsStore.petCount = 2;
    settingsStore.saveVideoPath("C:/cats/first.mp4", "idle_loop", 0);

    const didShowAny = colony.showAll();

    assert.equal(didShowAny, true);
    assert.equal(windows[0].isVisible, true);
    assert.equal(windows[1].isVisible, false);
  } finally {
    cleanup();
  }
});

test("hideAll hides every controller and click-through forwards to all controllers", () => {
  const { settingsStore, colony, windows, cleanup } = makeHarness();
  try {
    settingsStore.petCount = 2;
    settingsStore.saveVideoPath("C:/cats/first.mp4", "idle_loop", 0);
    settingsStore.saveVideoPath("C:/cats/second.mp4", "idle_loop", 1);
    colony.showAll();

    colony.setClickThrough(true);
    colony.hideAll();

    assert.deepEqual(windows.map((window) => window.clickThrough), [true, true]);
    assert.deepEqual(windows.map((window) => window.isVisible), [false, false]);
  } finally {
    cleanup();
  }
});

test("removing a pet compacts settings and hides removed windows", () => {
  const { settingsStore, colony, windows, cleanup } = makeHarness();
  try {
    settingsStore.petCount = 2;
    settingsStore.setPetName("栗子", 0);
    settingsStore.setPetName("团子", 1);
    settingsStore.saveVideoPath("C:/cats/first.mp4", "idle_loop", 0);
    settingsStore.saveVideoPath("C:/cats/second.mp4", "idle_loop", 1);
    settingsStore.isPetVisible = true;
    colony.showAll();

    const didShowAny = colony.removePet(0);

    assert.equal(didShowAny, true);
    assert.equal(settingsStore.petCount, 1);
    assert.equal(settingsStore.petName(0), "团子");
    assert.equal(settingsStore.restoreVideoPath("idle_loop", 0), "C:/cats/second.mp4");
    assert.ok(windows[0].hideCount >= 1);
  } finally {
    cleanup();
  }
});
