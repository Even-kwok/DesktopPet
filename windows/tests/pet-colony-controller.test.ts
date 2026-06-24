import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PetColonyController } from "../src/main/pet-colony-controller.ts";
import { SettingsStore } from "../src/shared/settings-store.ts";
import type { PetActionSlot, PetInteractionSide } from "../src/shared/pet-action-slots.ts";

class FakePetWindow {
  isVisible = false;
  hideCount = 0;
  clickThrough = false;
  sizeScale = 1;
  frame = { x: 0, y: 0, width: 150, height: 150 };
  triggeredSlots: PetActionSlot[] = [];
  bringToFrontCount = 0;
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
  resetPosition() {
    this.frame = { x: 0, y: 0, width: 150, height: 150 };
  }

  bringToFront() {
    this.bringToFrontCount += 1;
  }

  randomNearbyPetInteractionSlot(side: PetInteractionSide) {
    return side === "left" ? "head_rub_left" : "head_rub_right";
  }

  triggerNearbyPetInteraction(slot: PetActionSlot) {
    if (!this.settingsStore.restoreVideoPath(slot, this.petIndex)) {
      return false;
    }

    this.triggeredSlots.push(slot);
    return true;
  }
}

function makeHarness(options?: ConstructorParameters<typeof PetColonyController>[2]) {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-colony-"));
  const settingsStore = new SettingsStore(path.join(dir, "settings.json"));
  const windows: FakePetWindow[] = [];
  const colony = new PetColonyController(settingsStore, (petIndex) => {
    const window = new FakePetWindow(settingsStore, petIndex);
    windows.push(window);
    return window;
  }, options);

  return {
    settingsStore,
    colony,
    windows,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function saveVideoFile(
  settingsStore: SettingsStore,
  fileName: string,
  slot: PetActionSlot = "idle_loop",
  petIndex = 0
) {
  const videoPath = path.join(path.dirname(settingsStore.filePath), fileName);
  writeFileSync(videoPath, "");
  settingsStore.saveVideoPath(videoPath, slot, petIndex);
  return videoPath;
}

test("showAll shows only pets with idle_loop videos", () => {
  const { settingsStore, colony, windows, cleanup } = makeHarness();
  try {
    settingsStore.petCount = 2;
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);

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
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);
    saveVideoFile(settingsStore, "second.mp4", "idle_loop", 1);
    colony.showAll();

    colony.setClickThrough(true);
    colony.hideAll();

    assert.deepEqual(windows.map((window) => window.clickThrough), [true, true]);
    assert.deepEqual(windows.map((window) => window.isVisible), [false, false]);
  } finally {
    cleanup();
  }
});

test("brings active pet windows to the front", () => {
  const { settingsStore, colony, windows, cleanup } = makeHarness();
  try {
    settingsStore.petCount = 2;
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);
    saveVideoFile(settingsStore, "second.mp4", "idle_loop", 1);
    colony.showAll();
    settingsStore.petCount = 1;

    colony.bringToFront();

    assert.deepEqual(windows.map((window) => window.bringToFrontCount), [1, 0]);
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
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);
    const secondPath = saveVideoFile(settingsStore, "second.mp4", "idle_loop", 1);
    settingsStore.isPetVisible = true;
    colony.showAll();

    const didShowAny = colony.removePet(0);

    assert.equal(didShowAny, true);
    assert.equal(settingsStore.petCount, 1);
    assert.equal(settingsStore.petName(0), "团子");
    assert.equal(settingsStore.restoreVideoPath("idle_loop", 0), secondPath);
    assert.ok(windows[0].hideCount >= 1);
  } finally {
    cleanup();
  }
});

test("ignores invalid pet indexes from renderer commands", () => {
  const { settingsStore, colony, windows, cleanup } = makeHarness();
  try {
    settingsStore.petCount = 2;
    settingsStore.setPetName("栗子", 0);
    settingsStore.setPetName("团子", 1);
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);
    saveVideoFile(settingsStore, "second.mp4", "idle_loop", 1);
    settingsStore.isPetVisible = true;
    colony.showAll();

    const didShowAny = colony.removePet(Number.NaN);

    assert.doesNotThrow(() => colony.setPetSizeScale(0.6, Number.NaN));
    assert.equal(didShowAny, true);
    assert.equal(settingsStore.petCount, 2);
    assert.equal(settingsStore.petName(0), "栗子");
    assert.equal(settingsStore.petName(1), "团子");
    assert.deepEqual(windows.map((window) => window.isVisible), [true, true]);
  } finally {
    cleanup();
  }
});

test("nearby pets trigger paired interactions with cooldown", () => {
  let now = 1000;
  const { settingsStore, colony, windows, cleanup } = makeHarness({
    random: () => 0,
    now: () => now,
    proximityInteractionProbability: 1,
    proximityInteractionCooldownMs: 24000
  });
  try {
    settingsStore.petCount = 2;
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);
    saveVideoFile(settingsStore, "first-left.mp4", "head_rub_left", 0);
    saveVideoFile(settingsStore, "second.mp4", "idle_loop", 1);
    saveVideoFile(settingsStore, "second-right.mp4", "head_rub_right", 1);
    colony.showAll();
    windows[0].frame = { x: 100, y: 100, width: 150, height: 150 };
    windows[1].frame = { x: 80, y: 100, width: 150, height: 150 };

    colony.checkNearbyPetInteractions();
    assert.deepEqual(windows[0].triggeredSlots, ["head_rub_left"]);
    assert.deepEqual(windows[1].triggeredSlots, ["head_rub_right"]);

    colony.checkNearbyPetInteractions();
    assert.deepEqual(windows[0].triggeredSlots, ["head_rub_left"]);

    now += 25000;
    colony.checkNearbyPetInteractions();
    assert.deepEqual(windows[0].triggeredSlots, ["head_rub_left", "head_rub_left"]);
  } finally {
    cleanup();
  }
});

test("stops proximity checks when wake resumes while pets are hidden", () => {
  let clearCount = 0;
  const fakeTimer = {} as unknown as ReturnType<typeof setInterval>;
  const { settingsStore, colony, cleanup } = makeHarness({
    scheduleProximityCheck: () => fakeTimer,
    clearProximityCheck: (timer) => {
      assert.equal(timer, fakeTimer);
      clearCount += 1;
    }
  });

  try {
    settingsStore.petCount = 2;
    saveVideoFile(settingsStore, "first.mp4", "idle_loop", 0);
    saveVideoFile(settingsStore, "second.mp4", "idle_loop", 1);
    colony.showAll();
    settingsStore.isPetVisible = false;

    assert.equal(colony.resumeAfterSystemWake(), false);
    assert.equal(clearCount, 1);
  } finally {
    cleanup();
  }
});
