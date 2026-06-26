import assert from "node:assert/strict";
import test from "node:test";
import {
  petWindowBrowserOptions,
  studioWindowBrowserOptions
} from "../src/main/electron-window-options.ts";

test("builds Windows pet BrowserWindow options for transparent always-on-top desktop pets", () => {
  assert.deepEqual(
    petWindowBrowserOptions({
      bounds: { x: 12, y: 34, width: 150, height: 150 },
      title: "CatDesktopPet - 栗子",
      preloadPath: "C:/app/out/preload/index.cjs"
    }),
    {
      x: 12,
      y: 34,
      width: 150,
      height: 150,
      title: "CatDesktopPet - 栗子",
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      focusable: false,
      resizable: false,
      minWidth: 150,
      minHeight: 150,
      maxWidth: 150,
      maxHeight: 150,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: "C:/app/out/preload/index.cjs",
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    }
  );
});

test("builds Windows Studio BrowserWindow options with a sandboxed preload bridge", () => {
  assert.deepEqual(studioWindowBrowserOptions("C:/app/out/preload/index.cjs"), {
    width: 560,
    height: 560,
    minWidth: 520,
    minHeight: 460,
    title: "CatDesktopPet",
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false,
    webPreferences: {
      preload: "C:/app/out/preload/index.cjs",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
});

test("builds Windows Studio BrowserWindow title with app version when provided", () => {
  assert.equal(
    studioWindowBrowserOptions("C:/app/out/preload/index.cjs", "0.1.2").title,
    "CatDesktopPet v0.1.2"
  );
});
