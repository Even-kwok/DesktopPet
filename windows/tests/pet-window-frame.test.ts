import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  petFrameForScreen,
  resetPetFrameForScreen,
  setPetSizeScaleForScreen
} from "../src/main/pet-window-frame.ts";
import { SettingsStore } from "../src/shared/settings-store.ts";

function makeStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-frame-"));
  const store = new SettingsStore(path.join(dir, "settings.json"));
  return {
    store,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("uses the actual screen size for first pet frame", () => {
  const { store, cleanup } = makeStore();
  try {
    assert.deepEqual(petFrameForScreen(store, 0, { width: 1920, height: 1080 }), {
      x: 885,
      y: 465,
      width: 150,
      height: 150
    });
  } finally {
    cleanup();
  }
});

test("includes the Windows work area origin when deriving default pet frames", () => {
  const { store, cleanup } = makeStore();
  try {
    assert.deepEqual(petFrameForScreen(store, 0, { x: 100, y: 80, width: 1920, height: 1080 }), {
      x: 985,
      y: 545,
      width: 150,
      height: 150
    });
  } finally {
    cleanup();
  }
});

test("resets and resizes around the screen-derived pet center", () => {
  const { store, cleanup } = makeStore();
  try {
    store.petCount = 2;
    store.setPetFrame({ x: 10, y: 20, width: 30, height: 40 }, 1);
    store.setPetSizeScale(0.5, 1);

    const resetFrame = resetPetFrameForScreen(store, 1, { width: 1920, height: 1080 });
    assert.deepEqual(resetFrame, { x: 956.5, y: 502.5, width: 75, height: 75 });

    const resizedFrame = setPetSizeScaleForScreen(store, 1, 1, { width: 1920, height: 1080 });
    assert.deepEqual(resizedFrame, { x: 919, y: 465, width: 150, height: 150 });
  } finally {
    cleanup();
  }
});
