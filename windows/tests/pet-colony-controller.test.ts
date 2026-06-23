import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
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
    settingsStore.saveVideoPath("C:/cats/first.mp4", "idle_loop", 0);
    settingsStore.saveVideoPath("C:/cats/first-left.mp4", "head_rub_left", 0);
    settingsStore.saveVideoPath("C:/cats/second.mp4", "idle_loop", 1);
    settingsStore.saveVideoPath("C:/cats/second-right.mp4", "head_rub_right", 1);
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
