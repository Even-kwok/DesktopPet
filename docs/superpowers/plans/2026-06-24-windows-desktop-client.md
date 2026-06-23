# Windows Desktop Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron + React + TypeScript Windows desktop client that matches the current Mac desktop pet feature set.

**Architecture:** Add a new `windows/` Electron app beside the existing Swift Mac app and Next.js web app. Electron's main process owns Windows integration, tray menus, transparent pet windows, local file access, persistence, downloads, and sleep/wake recovery; React renderers own the pet canvas/video view and compact studio UI. Shared TypeScript modules hold action slots, state machine, settings, sync, and validation logic so most behavior is covered by Node tests.

**Tech Stack:** Electron, React, TypeScript, Vite/electron-vite, Node's built-in test runner, HTML video/canvas, Electron BrowserWindow/Tray/Menu IPC APIs.

---

## File Structure

Create the Windows client under `windows/` only. Existing Swift and web files remain unchanged except for README/docs updates after the client exists.

- `windows/package.json`: scripts, dependencies, and Node test command.
- `windows/tsconfig.json`: strict TS config for app and tests.
- `windows/tsconfig.node.json`: Electron main/preload TS config.
- `windows/electron.vite.config.ts`: main/preload/renderer build entries.
- `windows/index.html`: studio renderer shell.
- `windows/pet.html`: pet renderer shell.
- `windows/src/shared/pet-action-slots.ts`: Mac-compatible material slot ids, display names, trigger groups, material groups, and response pairs.
- `windows/src/shared/pet-state-machine.ts`: Mac-compatible pet state transitions.
- `windows/src/shared/video-import-review.ts`: Mac-compatible local video import limits and messages.
- `windows/src/shared/settings-store.ts`: JSON-backed settings, pet names/count, per-pet frames, size scales, video paths, account session, synced pet cards.
- `windows/src/shared/desktop-sync-client.ts`: desktop login, pet bundle fetch, friend APIs, hosting APIs, recall, replacement detection, remote material download helpers.
- `windows/src/shared/sleep-recovery-coordinator.ts`: suspend/resume debounce logic.
- `windows/src/shared/studio-model.ts`: derived studio card state, host/recall visibility, and account display copy.
- `windows/src/main/app.ts`: Electron app bootstrap.
- `windows/src/main/tray-controller.ts`: tray menu template construction and menu action dispatch.
- `windows/src/main/pet-colony-controller.ts`: multi-pet lifecycle and nearby-pet interaction scheduling.
- `windows/src/main/pet-window-controller.ts`: per-pet BrowserWindow lifecycle and playback command routing.
- `windows/src/main/studio-window-controller.ts`: compact studio BrowserWindow lifecycle.
- `windows/src/main/ipc.ts`: typed IPC handlers used by preload.
- `windows/src/preload/index.ts`: safe typed bridge exposed as `window.desktopPet`.
- `windows/src/renderer/pet/PetWindow.tsx`: transparent pet renderer.
- `windows/src/renderer/pet/chroma-key.ts`: canvas chroma-key frame processing.
- `windows/src/renderer/studio/StudioApp.tsx`: compact account/sync/friends/local-material UI.
- `windows/src/renderer/main.tsx`: studio renderer entry.
- `windows/src/renderer/pet-main.tsx`: pet renderer entry.
- `windows/src/renderer/styles.css`: compact desktop UI and transparent pet canvas styling.
- `windows/tests/*.test.ts`: Node tests for shared logic and Electron-independent controller behavior.
- `README.md`: add Windows run instructions and describe the new product surface.

## Task 1: Scaffold Windows Workspace

**Files:**
- Create: `windows/package.json`
- Create: `windows/tsconfig.json`
- Create: `windows/tsconfig.node.json`
- Create: `windows/electron.vite.config.ts`
- Create: `windows/index.html`
- Create: `windows/pet.html`
- Create: `windows/src/renderer/main.tsx`
- Create: `windows/src/renderer/pet-main.tsx`
- Create: `windows/src/renderer/styles.css`

- [ ] **Step 1: Create package and TypeScript configuration**

Add `windows/package.json`:

```json
{
  "name": "cat-desktop-pet-windows",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "out/main/app.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "test": "node --experimental-strip-types --test tests/*.test.ts"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.1.2",
    "electron-vite": "^4.0.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "electron": "^39.2.7",
    "typescript": "^5.9.3",
    "vite": "^7.3.0"
  }
}
```

Add `windows/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"]
}
```

Add `windows/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node", "electron"]
  },
  "include": ["electron.vite.config.ts", "src/main/**/*.ts", "src/preload/**/*.ts", "src/shared/**/*.ts"]
}
```

- [ ] **Step 2: Add Electron/Vite shell files**

Add `windows/electron.vite.config.ts`:

```ts
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: "src/main/app.ts"
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: "src/preload/index.ts"
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          studio: "index.html",
          pet: "pet.html"
        }
      }
    }
  }
});
```

Add `windows/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CatDesktopPet Windows</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

Add `windows/pet.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CatDesktopPet Pet</title>
  </head>
  <body class="pet-window">
    <div id="root"></div>
    <script type="module" src="/src/renderer/pet-main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Add temporary renderer entries**

Add `windows/src/renderer/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import "./styles.css";

function BootstrapStudio() {
  return (
    <main className="studio-shell">
      <h1>CatDesktopPet Windows</h1>
      <p>Windows desktop client is starting.</p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(<BootstrapStudio />);
```

Add `windows/src/renderer/pet-main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import "./styles.css";

function BootstrapPet() {
  return <div className="pet-bootstrap" aria-label="CatDesktopPet pet window" />;
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(<BootstrapPet />);
```

Add `windows/src/renderer/styles.css`:

```css
:root {
  color: #252525;
  background: transparent;
  font-family: "Segoe UI", system-ui, sans-serif;
}

body {
  margin: 0;
}

.studio-shell {
  min-height: 100vh;
  padding: 20px;
  background: #faf7f2;
}

.studio-shell h1 {
  margin: 0 0 8px;
  font-size: 22px;
}

.studio-shell p {
  margin: 0;
  color: #6b625b;
}

.pet-window {
  overflow: hidden;
  background: transparent;
}

.pet-bootstrap {
  width: 100vw;
  height: 100vh;
  background: transparent;
}
```

- [ ] **Step 4: Install dependencies and verify scaffold**

Run:

```bash
cd windows
npm install
npm run typecheck
```

Expected: dependency installation completes, then TypeScript reports no errors.

- [ ] **Step 5: Commit scaffold**

Run:

```bash
git add windows/package.json windows/package-lock.json windows/tsconfig.json windows/tsconfig.node.json windows/electron.vite.config.ts windows/index.html windows/pet.html windows/src/renderer/main.tsx windows/src/renderer/pet-main.tsx windows/src/renderer/styles.css
git commit -m "feat: scaffold windows electron client"
```

## Task 2: Pet Action Slots

**Files:**
- Create: `windows/tests/pet-action-slots.test.ts`
- Create: `windows/src/shared/pet-action-slots.ts`

- [ ] **Step 1: Write failing action slot test**

Add `windows/tests/pet-action-slots.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  allPetActionSlots,
  clickReactionSlots,
  idleRandomActionSlots,
  materialGroupForSlot,
  matchingNearbyResponseSlot,
  mouseoverCatchSlots,
  nearbyPetInteractionSlots,
  petActionSlotDisplayName,
  petSizeScaleOptions
} from "../src/shared/pet-action-slots.ts";

test("matches the Mac material slot order and labels", () => {
  assert.deepEqual(allPetActionSlots, [
    "idle_loop",
    "catch_bug",
    "catch_bug_up",
    "click_react",
    "head_rub_left",
    "head_rub_right",
    "angry_swipe_left",
    "angry_swipe_right",
    "yawn",
    "lick_belly",
    "lick_back",
    "stretch",
    "happy",
    "disgusted",
    "full_wash_face",
    "hungry_meow",
    "clingy",
    "aloof",
    "belly_up",
    "look_at_camera",
    "salary_cat_stinky_dance",
    "head_bob_dance",
    "sleep_loop"
  ]);
  assert.equal(petActionSlotDisplayName("idle_loop"), "待机循环");
  assert.equal(petActionSlotDisplayName("salary_cat_stinky_dance"), "跳月薪喵散屁舞");
  assert.equal(petActionSlotDisplayName("sleep_loop"), "睡觉");
});

test("groups trigger pools like the Mac app", () => {
  assert.deepEqual(mouseoverCatchSlots, ["catch_bug", "catch_bug_up"]);
  assert.deepEqual(clickReactionSlots, [
    "click_react",
    "happy",
    "disgusted",
    "clingy",
    "aloof",
    "belly_up"
  ]);
  assert.deepEqual(idleRandomActionSlots, [
    "yawn",
    "lick_belly",
    "lick_back",
    "stretch",
    "happy",
    "disgusted",
    "full_wash_face",
    "hungry_meow",
    "clingy",
    "aloof",
    "belly_up",
    "look_at_camera",
    "salary_cat_stinky_dance",
    "head_bob_dance"
  ]);
});

test("pairs nearby pet interactions by side and action type", () => {
  assert.deepEqual(nearbyPetInteractionSlots("left"), ["head_rub_left", "angry_swipe_left"]);
  assert.deepEqual(nearbyPetInteractionSlots("right"), ["head_rub_right", "angry_swipe_right"]);
  assert.equal(matchingNearbyResponseSlot("head_rub_left"), "head_rub_right");
  assert.equal(matchingNearbyResponseSlot("angry_swipe_right"), "angry_swipe_left");
  assert.equal(matchingNearbyResponseSlot("happy"), undefined);
});

test("classifies material groups and size choices", () => {
  assert.equal(materialGroupForSlot("idle_loop"), "core");
  assert.equal(materialGroupForSlot("click_react"), "pointer");
  assert.equal(materialGroupForSlot("head_rub_left"), "nearbyPet");
  assert.equal(materialGroupForSlot("look_at_camera"), "idleLife");
  assert.equal(materialGroupForSlot("hungry_meow"), "feeding");
  assert.deepEqual(petSizeScaleOptions, [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd windows
npm test tests/pet-action-slots.test.ts
```

Expected: FAIL with module-not-found for `../src/shared/pet-action-slots.ts`.

- [ ] **Step 3: Implement pet action slots**

Add `windows/src/shared/pet-action-slots.ts`:

```ts
export type PetActionSlot =
  | "idle_loop"
  | "catch_bug"
  | "catch_bug_up"
  | "click_react"
  | "head_rub_left"
  | "head_rub_right"
  | "angry_swipe_left"
  | "angry_swipe_right"
  | "yawn"
  | "lick_belly"
  | "lick_back"
  | "stretch"
  | "happy"
  | "disgusted"
  | "full_wash_face"
  | "hungry_meow"
  | "clingy"
  | "aloof"
  | "belly_up"
  | "look_at_camera"
  | "salary_cat_stinky_dance"
  | "head_bob_dance"
  | "drag_loop"
  | "sleep_loop";

export type VisiblePetActionSlot = Exclude<PetActionSlot, "drag_loop">;
export type PetInteractionSide = "left" | "right";
export type PetMaterialGroup = "core" | "pointer" | "nearbyPet" | "idleLife" | "feeding" | "reserved";

export const allPetActionSlots: VisiblePetActionSlot[] = [
  "idle_loop",
  "catch_bug",
  "catch_bug_up",
  "click_react",
  "head_rub_left",
  "head_rub_right",
  "angry_swipe_left",
  "angry_swipe_right",
  "yawn",
  "lick_belly",
  "lick_back",
  "stretch",
  "happy",
  "disgusted",
  "full_wash_face",
  "hungry_meow",
  "clingy",
  "aloof",
  "belly_up",
  "look_at_camera",
  "salary_cat_stinky_dance",
  "head_bob_dance",
  "sleep_loop"
];

const displayNames: Record<PetActionSlot, string> = {
  idle_loop: "待机循环",
  catch_bug: "鼠标经过抓虫子",
  catch_bug_up: "双手抓上方虫子",
  click_react: "点击反应",
  head_rub_left: "左边头蹭蹭",
  head_rub_right: "右边头蹭蹭",
  angry_swipe_left: "向左看生气挥一下爪子",
  angry_swipe_right: "向右看生气挥一下爪子",
  yawn: "打哈欠",
  lick_belly: "舔肚子的毛",
  lick_back: "舔背部的毛",
  stretch: "伸懒腰",
  happy: "开心",
  disgusted: "嫌弃",
  full_wash_face: "吃饱满足洗脸",
  hungry_meow: "饿了嗷嗷叫",
  clingy: "粘人",
  aloof: "高冷",
  belly_up: "躺下翻肚皮",
  look_at_camera: "看镜头",
  salary_cat_stinky_dance: "跳月薪喵散屁舞",
  head_bob_dance: "摇头晃脑舞",
  drag_loop: "拖拽循环（备用）",
  sleep_loop: "睡觉"
};

export const mouseoverCatchSlots: VisiblePetActionSlot[] = ["catch_bug", "catch_bug_up"];

export const clickReactionSlots: VisiblePetActionSlot[] = [
  "click_react",
  "happy",
  "disgusted",
  "clingy",
  "aloof",
  "belly_up"
];

export const idleRandomActionSlots: VisiblePetActionSlot[] = [
  "yawn",
  "lick_belly",
  "lick_back",
  "stretch",
  "happy",
  "disgusted",
  "full_wash_face",
  "hungry_meow",
  "clingy",
  "aloof",
  "belly_up",
  "look_at_camera",
  "salary_cat_stinky_dance",
  "head_bob_dance"
];

export function petActionSlotDisplayName(slot: PetActionSlot) {
  return displayNames[slot];
}

export function nearbyPetInteractionSlots(side: PetInteractionSide): VisiblePetActionSlot[] {
  return side === "left"
    ? ["head_rub_left", "angry_swipe_left"]
    : ["head_rub_right", "angry_swipe_right"];
}

export function matchingNearbyResponseSlot(slot: PetActionSlot): VisiblePetActionSlot | undefined {
  switch (slot) {
    case "head_rub_left":
      return "head_rub_right";
    case "head_rub_right":
      return "head_rub_left";
    case "angry_swipe_left":
      return "angry_swipe_right";
    case "angry_swipe_right":
      return "angry_swipe_left";
    default:
      return undefined;
  }
}

export function materialGroupForSlot(slot: PetActionSlot): PetMaterialGroup {
  switch (slot) {
    case "idle_loop":
    case "sleep_loop":
      return "core";
    case "click_react":
    case "catch_bug":
    case "catch_bug_up":
      return "pointer";
    case "head_rub_left":
    case "head_rub_right":
    case "angry_swipe_left":
    case "angry_swipe_right":
      return "nearbyPet";
    case "yawn":
    case "lick_belly":
    case "lick_back":
    case "stretch":
    case "happy":
    case "disgusted":
    case "clingy":
    case "aloof":
    case "belly_up":
    case "look_at_camera":
    case "salary_cat_stinky_dance":
    case "head_bob_dance":
      return "idleLife";
    case "full_wash_face":
    case "hungry_meow":
      return "feeding";
    case "drag_loop":
      return "reserved";
  }
}

export const petSizeScaleOptions = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3] as const;
export const minPetSizeScale = 0.3;
export const maxPetSizeScale = 1;

export function clampPetSizeScale(scale: number) {
  if (!Number.isFinite(scale)) {
    return maxPetSizeScale;
  }

  return Math.min(maxPetSizeScale, Math.max(minPetSizeScale, scale));
}
```

- [ ] **Step 4: Run the test and typecheck**

Run:

```bash
cd windows
npm test tests/pet-action-slots.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit action slots**

Run:

```bash
git add windows/tests/pet-action-slots.test.ts windows/src/shared/pet-action-slots.ts
git commit -m "feat: add windows pet action slots"
```

## Task 3: Pet State Machine

**Files:**
- Create: `windows/tests/pet-state-machine.test.ts`
- Create: `windows/src/shared/pet-state-machine.ts`

- [ ] **Step 1: Write failing state machine tests**

Add `windows/tests/pet-state-machine.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { PetStateMachine } from "../src/shared/pet-state-machine.ts";

test("moves from hidden to idle and back to hidden", () => {
  const states: string[] = [];
  const machine = new PetStateMachine((state) => states.push(state));

  assert.equal(machine.state, "hidden");
  machine.send("show");
  machine.send("hide");

  assert.deepEqual(states, ["idle", "hidden"]);
  assert.equal(machine.state, "hidden");
});

test("only allows sleep from idle and wake from sleeping", () => {
  const machine = new PetStateMachine();

  machine.send("sleep");
  assert.equal(machine.state, "hidden");

  machine.send("show");
  machine.send("sleep");
  assert.equal(machine.state, "sleeping");

  machine.send("wake");
  assert.equal(machine.state, "idle");
});

test("reactions return to idle after reactionFinished", () => {
  const machine = new PetStateMachine();
  machine.send("show");

  for (const event of ["click", "mouseOverPet", "idleActionDue", "nearbyPet"] as const) {
    machine.send(event);
    assert.notEqual(machine.state, "idle");
    machine.send("reactionFinished");
    assert.equal(machine.state, "idle");
  }
});

test("drag ends with dropped and scheduler returns to idle", () => {
  const scheduled: Array<() => void> = [];
  const machine = new PetStateMachine(undefined, (callback) => scheduled.push(callback));

  machine.send("show");
  machine.send("dragStarted");
  assert.equal(machine.state, "grabbed");

  machine.send("dragEnded");
  assert.equal(machine.state, "dropped");
  assert.equal(scheduled.length, 1);

  scheduled[0]();
  assert.equal(machine.state, "idle");
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd windows
npm test tests/pet-state-machine.test.ts
```

Expected: FAIL with module-not-found for `../src/shared/pet-state-machine.ts`.

- [ ] **Step 3: Implement state machine**

Add `windows/src/shared/pet-state-machine.ts`:

```ts
export type PetState =
  | "hidden"
  | "idle"
  | "sleeping"
  | "clicked"
  | "catchingBug"
  | "idleAction"
  | "socialInteraction"
  | "grabbed"
  | "dropped";

export type PetEvent =
  | "show"
  | "hide"
  | "click"
  | "mouseOverPet"
  | "idleActionDue"
  | "nearbyPet"
  | "reactionFinished"
  | "dragStarted"
  | "dragEnded"
  | "sleep"
  | "wake";

export type StateChanged = (state: PetState) => void;
export type ReturnToIdleScheduler = (callback: () => void, delayMs: number) => void;

export class PetStateMachine {
  #state: PetState = "hidden";
  #token = 0;
  readonly #onStateChanged?: StateChanged;
  readonly #scheduleReturnToIdle: ReturnToIdleScheduler;

  constructor(
    onStateChanged?: StateChanged,
    scheduleReturnToIdle: ReturnToIdleScheduler = (callback, delayMs) => {
      setTimeout(callback, delayMs);
    }
  ) {
    this.#onStateChanged = onStateChanged;
    this.#scheduleReturnToIdle = scheduleReturnToIdle;
  }

  get state() {
    return this.#state;
  }

  send(event: PetEvent) {
    switch (event) {
      case "show":
        this.#transitionTo("idle");
        break;
      case "hide":
        this.#transitionTo("hidden");
        break;
      case "sleep":
        if (this.#state === "idle") {
          this.#transitionTo("sleeping");
        }
        break;
      case "wake":
        if (this.#state === "sleeping") {
          this.#transitionTo("idle");
        }
        break;
      case "click":
        if (this.#state !== "grabbed" && this.#state !== "hidden") {
          this.#transitionTo("clicked");
        }
        break;
      case "mouseOverPet":
        if (this.#state === "idle") {
          this.#transitionTo("catchingBug");
        }
        break;
      case "idleActionDue":
        if (this.#state === "idle") {
          this.#transitionTo("idleAction");
        }
        break;
      case "nearbyPet":
        if (this.#state === "idle") {
          this.#transitionTo("socialInteraction");
        }
        break;
      case "reactionFinished":
        if (["clicked", "catchingBug", "idleAction", "socialInteraction"].includes(this.#state)) {
          this.#transitionTo("idle");
        }
        break;
      case "dragStarted":
        if (this.#state !== "hidden") {
          this.#transitionTo("grabbed");
        }
        break;
      case "dragEnded":
        if (this.#state === "grabbed") {
          this.#transitionTo("dropped");
          this.#returnToIdle(240);
        }
        break;
    }
  }

  #transitionTo(nextState: PetState) {
    if (this.#state === nextState) {
      return;
    }

    this.#state = nextState;
    this.#token += 1;
    this.#onStateChanged?.(nextState);
  }

  #returnToIdle(delayMs: number) {
    const token = this.#token;

    this.#scheduleReturnToIdle(() => {
      if (this.#token === token && this.#state !== "hidden") {
        this.#transitionTo("idle");
      }
    }, delayMs);
  }
}
```

- [ ] **Step 4: Run state machine tests and typecheck**

Run:

```bash
cd windows
npm test tests/pet-state-machine.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit state machine**

Run:

```bash
git add windows/tests/pet-state-machine.test.ts windows/src/shared/pet-state-machine.ts
git commit -m "feat: add windows pet state machine"
```

## Task 4: Settings Store

**Files:**
- Create: `windows/tests/settings-store.test.ts`
- Create: `windows/src/shared/settings-store.ts`

- [ ] **Step 1: Write failing settings tests**

Add `windows/tests/settings-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd windows
npm test tests/settings-store.test.ts
```

Expected: FAIL with module-not-found for `../src/shared/settings-store.ts`.

- [ ] **Step 3: Implement JSON settings store**

Implement `windows/src/shared/settings-store.ts` with these exports and behaviors:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PetActionSlot } from "./pet-action-slots.ts";
import { clampPetSizeScale } from "./pet-action-slots.ts";

export type Rect = { x: number; y: number; width: number; height: number };

export type DesktopAccountSession = {
  id: string;
  name: string;
  email: string;
  credits: number;
  accessToken: string;
  signedInAt: string;
};

type PetSettings = {
  name?: string;
  sizeScale?: number;
  frame?: Rect;
  videos?: Partial<Record<PetActionSlot, string>>;
};

type SettingsData = {
  petCount?: number;
  isPetVisible?: boolean;
  isClickThrough?: boolean;
  isMouseoverCatchEnabled?: boolean;
  pets?: PetSettings[];
  currentAccount?: DesktopAccountSession;
};

const maxPetSize = { width: 150, height: 150 };

export class SettingsStore {
  readonly filePath: string;
  #data: SettingsData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.#data = this.#read();
  }

  get petCount() {
    return Math.max(0, this.#data.petCount ?? 1);
  }

  set petCount(count: number) {
    this.#data.petCount = Math.max(0, Math.trunc(count));
    this.#write();
  }

  get isPetVisible() {
    return this.#data.isPetVisible ?? false;
  }

  set isPetVisible(value: boolean) {
    this.#data.isPetVisible = value;
    this.#write();
  }

  get isClickThrough() {
    return this.#data.isClickThrough ?? false;
  }

  set isClickThrough(value: boolean) {
    this.#data.isClickThrough = value;
    this.#write();
  }

  get isMouseoverCatchEnabled() {
    return this.#data.isMouseoverCatchEnabled ?? true;
  }

  set isMouseoverCatchEnabled(value: boolean) {
    this.#data.isMouseoverCatchEnabled = value;
    this.#write();
  }

  get currentAccount() {
    return this.#data.currentAccount;
  }

  saveAccountSession(account: DesktopAccountSession) {
    this.#data.currentAccount = account;
    this.#write();
  }

  signOut() {
    delete this.#data.currentAccount;
    this.#write();
  }

  petName(index: number) {
    const name = this.#pet(index).name?.trim();
    return name ? name : `Pet ${index + 1}`;
  }

  setPetName(name: string, index: number) {
    const trimmed = name.trim();
    const pet = this.#pet(index);
    if (trimmed) {
      pet.name = trimmed;
    } else {
      delete pet.name;
    }
    this.#write();
  }

  petSizeScale(index: number) {
    return clampPetSizeScale(this.#pet(index).sizeScale ?? 1);
  }

  setPetSizeScale(scale: number, index: number) {
    const pet = this.#pet(index);
    pet.sizeScale = clampPetSizeScale(scale);
    pet.frame = applyPetSizeScale(this.petFrame(index), pet.sizeScale);
    this.#write();
  }

  petFrame(index: number, screenSize = { width: 1024, height: 768 }): Rect {
    const frame = this.#pet(index).frame;
    if (frame && frame.width > 0 && frame.height > 0) {
      return frame;
    }
    return applyPetSizeScale(defaultPetFrame(index, screenSize), this.petSizeScale(index));
  }

  setPetFrame(frame: Rect, index: number) {
    this.#pet(index).frame = frame;
    this.#write();
  }

  saveVideoPath(videoPath: string, slot: PetActionSlot, index: number) {
    const pet = this.#pet(index);
    pet.videos = { ...pet.videos, [slot]: videoPath };
    this.#write();
  }

  removeVideo(slot: PetActionSlot, index: number) {
    const pet = this.#pet(index);
    delete pet.videos?.[slot];
    this.#write();
  }

  restoreVideoPath(slot: PetActionSlot, index: number) {
    return this.#pet(index).videos?.[slot];
  }

  savedVideoSlots(index: number) {
    return Object.keys(this.#pet(index).videos ?? {}) as PetActionSlot[];
  }

  removePet(index: number) {
    if (index < 0 || index >= this.petCount) {
      return;
    }
    const pets = [...(this.#data.pets ?? [])];
    pets.splice(index, 1);
    this.#data.pets = pets;
    this.#data.petCount = Math.max(0, this.petCount - 1);
    this.#write();
  }

  #pet(index: number) {
    const pets = [...(this.#data.pets ?? [])];
    while (pets.length <= index) {
      pets.push({});
    }
    this.#data.pets = pets;
    return pets[index];
  }

  #read(): SettingsData {
    if (!existsSync(this.filePath)) {
      return {};
    }
    return JSON.parse(readFileSync(this.filePath, "utf8")) as SettingsData;
  }

  #write() {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.#data, null, 2));
  }
}

export function defaultPetFrame(index: number, screenSize: { width: number; height: number }): Rect {
  const columns = Math.max(1, Math.min(6, Math.trunc((screenSize.width - maxPetSize.width) / 42)));
  const column = Math.max(index, 0) % columns;
  const row = Math.trunc(Math.max(index, 0) / columns);

  return {
    x: screenSize.width / 2 - maxPetSize.width / 2 + column * 34,
    y: screenSize.height / 2 - maxPetSize.height / 2 - row * 34,
    width: maxPetSize.width,
    height: maxPetSize.height
  };
}

export function applyPetSizeScale(frame: Rect, scale: number): Rect {
  const clampedScale = clampPetSizeScale(scale);
  const width = maxPetSize.width * clampedScale;
  const height = maxPetSize.height * clampedScale;

  return {
    x: frame.x + frame.width / 2 - width / 2,
    y: frame.y + frame.height / 2 - height / 2,
    width,
    height
  };
}
```

- [ ] **Step 4: Run settings tests and typecheck**

Run:

```bash
cd windows
npm test tests/settings-store.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit settings store**

Run:

```bash
git add windows/tests/settings-store.test.ts windows/src/shared/settings-store.ts
git commit -m "feat: add windows settings store"
```

## Task 5: Video Import Review

**Files:**
- Create: `windows/tests/video-import-review.test.ts`
- Create: `windows/src/shared/video-import-review.ts`

- [ ] **Step 1: Write failing video import tests**

Add `windows/tests/video-import-review.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { reviewPetVideoImport } from "../src/shared/video-import-review.ts";

test("accepts normal short clips", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 12 * 1024 * 1024,
    durationSeconds: 8,
    hasVideoTrack: true
  });

  assert.equal(review.canImport, true);
  assert.deepEqual(review.blockingMessages, []);
  assert.deepEqual(review.warningMessages, []);
});

test("blocks files without video tracks", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 3 * 1024 * 1024,
    durationSeconds: 8,
    hasVideoTrack: false
  });

  assert.equal(review.canImport, false);
  assert.match(review.blockingMessages.join(" "), /视频画面/);
});

test("blocks long and oversized files", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 400 * 1024 * 1024,
    durationSeconds: 70,
    hasVideoTrack: true
  });

  assert.equal(review.canImport, false);
  assert.match(review.blockingMessages.join(" "), /60 秒以内/);
  assert.match(review.blockingMessages.join(" "), /300MB/);
});

test("warns for long or large clips that can still import", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 120 * 1024 * 1024,
    durationSeconds: 22,
    hasVideoTrack: true
  });

  assert.equal(review.canImport, true);
  assert.match(review.warningMessages.join(" "), /有点长/);
  assert.match(review.warningMessages.join(" "), /有点大/);
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd windows
npm test tests/video-import-review.test.ts
```

Expected: FAIL with module-not-found for `../src/shared/video-import-review.ts`.

- [ ] **Step 3: Implement import review**

Add `windows/src/shared/video-import-review.ts`:

```ts
export type PetVideoImportMetadata = {
  fileSizeBytes: number;
  durationSeconds: number;
  hasVideoTrack: boolean;
};

export type PetVideoImportReview = {
  canImport: boolean;
  blockingMessages: string[];
  warningMessages: string[];
};

const maxImportVideoBytes = 300 * 1024 * 1024;
const longImportVideoSeconds = 15;
const maxImportVideoSeconds = 60;
const largeImportVideoBytes = 80 * 1024 * 1024;

export function reviewPetVideoImport(metadata: PetVideoImportMetadata): PetVideoImportReview {
  const blockingMessages: string[] = [];
  const warningMessages: string[] = [];

  if (!metadata.hasVideoTrack) {
    blockingMessages.push("这段视频没有视频画面，请换一个 MP4 或 MOV。");
  }

  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0) {
    blockingMessages.push("这段视频时长异常，请换一个能正常播放的视频。");
  } else if (metadata.durationSeconds > maxImportVideoSeconds) {
    blockingMessages.push("这段视频太长了，请换 60 秒以内的视频。");
  } else if (metadata.durationSeconds > longImportVideoSeconds) {
    warningMessages.push("这段视频有点长，作为桌宠动作可能不够轻快。");
  }

  if (metadata.fileSizeBytes > maxImportVideoBytes) {
    blockingMessages.push("视频有点太大，请换 300MB 以内的视频。");
  } else if (metadata.fileSizeBytes > largeImportVideoBytes) {
    warningMessages.push("视频有点大，播放和同步可能更慢。");
  }

  return {
    canImport: blockingMessages.length === 0,
    blockingMessages,
    warningMessages
  };
}
```

- [ ] **Step 4: Run import tests and typecheck**

Run:

```bash
cd windows
npm test tests/video-import-review.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit import review**

Run:

```bash
git add windows/tests/video-import-review.test.ts windows/src/shared/video-import-review.ts
git commit -m "feat: add windows video import review"
```

## Task 6: Desktop Sync Client

**Files:**
- Create: `windows/tests/desktop-sync-client.test.ts`
- Create: `windows/src/shared/desktop-sync-client.ts`

- [ ] **Step 1: Write failing desktop sync tests**

Add `windows/tests/desktop-sync-client.test.ts` with tests that start a local `node:http` server and verify:

```ts
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import test from "node:test";
import {
  DesktopPetSyncClient,
  DesktopPetSyncError,
  displayablePets,
  localMaterialReplacementDescriptions
} from "../src/shared/desktop-sync-client.ts";

async function withServer(handler: (request: IncomingMessage, body: string) => { status: number; body: unknown }) {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      const result = handler(request, body);
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(JSON.stringify(result.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  const baseURL = `http://127.0.0.1:${address.port}`;

  return {
    baseURL,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

test("logs in and stores bearer-capable account response", async () => {
  const server = await withServer((request, body) => {
    assert.equal(request.url, "/api/desktop/auth/login");
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(body), { email: "demo@desktop.pet", password: "123456" });
    return {
      status: 200,
      body: {
        mode: "mock",
        tokenType: "bearer",
        accessToken: "desktop-token",
        expiresIn: 3600,
        account: { id: "user_demo", name: "栗子主人", email: "demo@desktop.pet", credits: 120 }
      }
    };
  });

  try {
    const client = new DesktopPetSyncClient(server.baseURL);
    const login = await client.login("demo@desktop.pet", "123456");
    assert.equal(login.accessToken, "desktop-token");
    assert.equal(login.account.email, "demo@desktop.pet");
  } finally {
    await server.close();
  }
});

test("fetches desktop bundle with bearer token and filters displayable pets", async () => {
  const server = await withServer((request) => {
    assert.equal(request.url, "/api/desktop/pets");
    assert.equal(request.headers.authorization, "Bearer desktop-token");
    return {
      status: 200,
      body: {
        version: 1,
        generatedAt: "2026-06-24T00:00:00.000Z",
        pets: [
          {
            id: "pet_local",
            name: "栗子",
            type: "cat",
            displayState: "active",
            materials: [{ slot: "idle_loop", name: "待机循环", videoUrl: "https://example.com/idle.mp4", status: "ready" }]
          },
          {
            id: "pet_away",
            name: "雪球",
            type: "cat",
            displayState: "unavailable",
            materials: [{ slot: "idle_loop", name: "待机循环", videoUrl: "https://example.com/idle.mp4", status: "ready" }]
          }
        ]
      }
    };
  });

  try {
    const client = new DesktopPetSyncClient(server.baseURL);
    const bundle = await client.fetchBundle("desktop-token");
    assert.equal(displayablePets(bundle).map((pet) => pet.id).join(","), "pet_local");
  } finally {
    await server.close();
  }
});

test("maps unauthorized bundle fetches to session expired", async () => {
  const server = await withServer(() => ({ status: 401, body: { error: "DESKTOP_AUTH_REQUIRED" } }));

  try {
    const client = new DesktopPetSyncClient(server.baseURL);
    await assert.rejects(client.fetchBundle("expired-token"), DesktopPetSyncError.sessionExpired);
  } finally {
    await server.close();
  }
});

test("describes local videos replaced by cloud sync", () => {
  const bundle = {
    version: 1,
    generatedAt: "2026-06-24T00:00:00.000Z",
    pets: [
      {
        id: "pet_orange",
        name: "栗子",
        type: "cat",
        displayState: "active",
        materials: [{ slot: "idle_loop", name: "待机循环", videoUrl: "https://example.com/idle.mp4", status: "ready" }]
      }
    ]
  } as const;

  const replacements = localMaterialReplacementDescriptions(bundle, (slot, petIndex) => {
    assert.equal(slot, "idle_loop");
    assert.equal(petIndex, 0);
    return "C:/local/idle.mp4";
  });

  assert.deepEqual(replacements, ["栗子 · 待机循环"]);
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd windows
npm test tests/desktop-sync-client.test.ts
```

Expected: FAIL with module-not-found for `../src/shared/desktop-sync-client.ts`.

- [ ] **Step 3: Implement desktop sync client**

Implement `windows/src/shared/desktop-sync-client.ts` with:

- `DesktopPetSyncError` class or constants for `invalidResponse`, `loginFailed`, `sessionExpired`, `emptyBundle`, `missingIdleLoop`.
- `DesktopPetSyncClient.login(email, password)` POSTing to `/api/desktop/auth/login`.
- `fetchBundle(accessToken)` GETting `/api/desktop/pets` with `Authorization: Bearer ...`.
- `fetchFriends`, `addFriend`, `removeFriend`, `requestHosting`, and `recallPet` using the same paths as the Mac client.
- `displayablePets(bundle)` returning pets with `displayState !== "unavailable"`, `displayState !== "hidden"`, and a ready `idle_loop`.
- `localMaterialReplacementDescriptions(bundle, restoreVideoPath)` matching the Mac replacement warning behavior.

- [ ] **Step 4: Run sync tests and typecheck**

Run:

```bash
cd windows
npm test tests/desktop-sync-client.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit desktop sync client**

Run:

```bash
git add windows/tests/desktop-sync-client.test.ts windows/src/shared/desktop-sync-client.ts
git commit -m "feat: add windows desktop sync client"
```

## Task 7: Sleep Recovery And Studio Model

**Files:**
- Create: `windows/tests/sleep-recovery-coordinator.test.ts`
- Create: `windows/tests/studio-model.test.ts`
- Create: `windows/src/shared/sleep-recovery-coordinator.ts`
- Create: `windows/src/shared/studio-model.ts`

- [ ] **Step 1: Write failing sleep recovery tests**

Add `windows/tests/sleep-recovery-coordinator.test.ts` equivalent to the Swift tests:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { SleepRecoveryCoordinator } from "../src/shared/sleep-recovery-coordinator.ts";

test("willSleep prepares visible desktop pets once", () => {
  let prepareCount = 0;
  let resumeCount = 0;
  const coordinator = new SleepRecoveryCoordinator(
    () => (prepareCount += 1),
    () => (resumeCount += 1),
    (resume) => resume()
  );

  coordinator.systemWillSleep();
  coordinator.systemWillSleep();

  assert.equal(prepareCount, 1);
  assert.equal(resumeCount, 0);
});

test("only latest wake notification resumes", () => {
  let resumeCount = 0;
  const scheduled: Array<() => void> = [];
  const coordinator = new SleepRecoveryCoordinator(
    () => undefined,
    () => (resumeCount += 1),
    (resume) => scheduled.push(resume)
  );

  coordinator.systemWillSleep();
  coordinator.systemDidWake();
  coordinator.systemDidWake();

  scheduled[0]();
  assert.equal(resumeCount, 0);

  scheduled[1]();
  assert.equal(resumeCount, 1);
});
```

- [ ] **Step 2: Write failing studio model tests**

Add `windows/tests/studio-model.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { accountDetail, canRequestHosting, shouldShowRecallAction, statusTextForSyncedPet } from "../src/shared/studio-model.ts";

test("builds account display copy", () => {
  assert.equal(accountDetail(undefined), "登录后可同步网页端账号下的宠物数据。");
  assert.equal(
    accountDetail({ id: "u1", name: "栗子主人", email: "demo@desktop.pet", credits: 120, accessToken: "token", signedInAt: "now" }),
    "demo@desktop.pet · 120 积分"
  );
});

test("computes pet status and available actions", () => {
  assert.equal(statusTextForSyncedPet({ ownership: "owned", displayState: "active" }), "在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "hosted", displayState: "active" }), "寄养在我的桌面");
  assert.equal(statusTextForSyncedPet({ ownership: "away", displayState: "unavailable" }), "托管在朋友那里");
  assert.equal(canRequestHosting({ ownership: "owned", displayState: "active" }), true);
  assert.equal(canRequestHosting({ ownership: "hosted", displayState: "active" }), false);
  assert.equal(shouldShowRecallAction({ ownership: "away", displayState: "unavailable" }, true), true);
  assert.equal(shouldShowRecallAction({ ownership: "away", displayState: "unavailable" }, false), false);
});
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
cd windows
npm test tests/sleep-recovery-coordinator.test.ts tests/studio-model.test.ts
```

Expected: FAIL with module-not-found for the two shared modules.

- [ ] **Step 4: Implement shared modules**

Add `windows/src/shared/sleep-recovery-coordinator.ts`:

```ts
export type WakeResumeScheduler = (resume: () => void) => void;

export class SleepRecoveryCoordinator {
  #wakeGeneration = 0;
  #isPreparedForSleep = false;

  constructor(
    private readonly prepareForSleep: () => void,
    private readonly resumeAfterWake: () => void,
    private readonly scheduleWakeResume: WakeResumeScheduler = (resume) => {
      setTimeout(resume, 750);
    }
  ) {}

  systemWillSleep() {
    this.#wakeGeneration += 1;

    if (this.#isPreparedForSleep) {
      return;
    }

    this.#isPreparedForSleep = true;
    this.prepareForSleep();
  }

  systemDidWake() {
    this.#wakeGeneration += 1;
    const generation = this.#wakeGeneration;

    this.scheduleWakeResume(() => {
      if (this.#wakeGeneration !== generation) {
        return;
      }

      this.#isPreparedForSleep = false;
      this.resumeAfterWake();
    });
  }
}
```

Add `windows/src/shared/studio-model.ts` with pure functions for account detail, synced pet status, request hosting availability, and recall visibility using the same rules as Mac.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
cd windows
npm test tests/sleep-recovery-coordinator.test.ts tests/studio-model.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 6: Commit shared support modules**

Run:

```bash
git add windows/tests/sleep-recovery-coordinator.test.ts windows/tests/studio-model.test.ts windows/src/shared/sleep-recovery-coordinator.ts windows/src/shared/studio-model.ts
git commit -m "feat: add windows desktop shared models"
```

## Task 8: Electron Main Controllers

**Files:**
- Create: `windows/tests/tray-controller.test.ts`
- Create: `windows/tests/pet-colony-controller.test.ts`
- Create: `windows/src/main/tray-controller.ts`
- Create: `windows/src/main/pet-colony-controller.ts`
- Create: `windows/src/main/pet-window-controller.ts`
- Create: `windows/src/main/studio-window-controller.ts`

- [ ] **Step 1: Write failing tray menu tests**

Add `windows/tests/tray-controller.test.ts` with pure menu-template tests:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildTrayMenuTemplate } from "../src/main/tray-controller.ts";

test("builds Mac-parity tray menu labels", () => {
  const template = buildTrayMenuTemplate({
    petCount: 1,
    isVisible: false,
    isClickThrough: false,
    isMouseoverCatchEnabled: true,
    petName: () => "栗子",
    hasVideo: (slot) => slot === "idle_loop",
    petSizeScale: () => 1
  });

  assert.deepEqual(
    template.filter((item) => item.type !== "separator").map((item) => item.label),
    ["打开素材工作台", "选择状态视频", "删除状态视频", "宠物", "显示宠物", "切换点击穿透", "切换鼠标经过抓虫", "重置位置", "退出"]
  );
});
```

- [ ] **Step 2: Write failing pet colony tests**

Add `windows/tests/pet-colony-controller.test.ts` with fakes that verify:

- `showAll()` shows only pets with `idle_loop`.
- `hideAll()` hides every controller.
- `setClickThrough(true)` forwards to all pet windows.
- `removePet(0)` compacts settings and hides removed windows.

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
cd windows
npm test tests/tray-controller.test.ts tests/pet-colony-controller.test.ts
```

Expected: FAIL with module-not-found for main controller modules.

- [ ] **Step 4: Implement controller cores**

Implement controller modules with explicit constructor dependencies:

- `TrayController` receives settings, pet colony, open studio callback, Electron `Tray/Menu` adapter, and rebuilds the menu after actions.
- `buildTrayMenuTemplate` is exported for tests and returns Electron-compatible menu templates.
- `PetColonyController` receives settings and a pet-window factory. It mirrors Mac methods: `setPetCount`, `addPet`, `removePet`, `showAll`, `hideAll`, `setClickThrough`, `setPetSizeScale`, `refreshPlayback`, `prepareForSystemSleep`, `resumeAfterSystemWake`, `refreshDisplayNames`, and `resetPositions`.
- `PetWindowController` wraps one BrowserWindow and exposes the same controller methods used by the colony.
- `StudioWindowController` creates or focuses the studio BrowserWindow.

- [ ] **Step 5: Run controller tests and typecheck**

Run:

```bash
cd windows
npm test tests/tray-controller.test.ts tests/pet-colony-controller.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 6: Commit main controller cores**

Run:

```bash
git add windows/tests/tray-controller.test.ts windows/tests/pet-colony-controller.test.ts windows/src/main/tray-controller.ts windows/src/main/pet-colony-controller.ts windows/src/main/pet-window-controller.ts windows/src/main/studio-window-controller.ts
git commit -m "feat: add windows electron controllers"
```

## Task 9: IPC And App Bootstrap

**Files:**
- Create: `windows/tests/ipc-contract.test.ts`
- Create: `windows/src/main/ipc.ts`
- Create: `windows/src/main/app.ts`
- Create: `windows/src/preload/index.ts`

- [ ] **Step 1: Write failing IPC contract test**

Add `windows/tests/ipc-contract.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { ipcChannels } from "../src/main/ipc.ts";

test("lists the stable preload IPC channels", () => {
  assert.deepEqual(ipcChannels, {
    getStudioState: "studio:get-state",
    signIn: "studio:sign-in",
    signOut: "studio:sign-out",
    sync: "studio:sync",
    addPet: "pets:add",
    renamePet: "pets:rename",
    importVideo: "pets:import-video",
    removeVideo: "pets:remove-video",
    setPetSize: "pets:set-size",
    showPets: "pets:show",
    hidePets: "pets:hide",
    toggleClickThrough: "pets:toggle-click-through",
    toggleMouseoverCatch: "pets:toggle-mouseover-catch",
    resetPositions: "pets:reset-positions",
    refreshFriends: "friends:refresh",
    addFriend: "friends:add",
    removeFriend: "friends:remove",
    requestHosting: "hosting:request",
    recallPet: "hosting:recall",
    petDragBy: "pet:drag-by",
    petClick: "pet:click",
    petPlaybackEnded: "pet:playback-ended"
  });
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
cd windows
npm test tests/ipc-contract.test.ts
```

Expected: FAIL with module-not-found for `../src/main/ipc.ts`.

- [ ] **Step 3: Implement IPC channel constants, handler registration, preload bridge, and bootstrap**

Implement:

- `ipcChannels` constant exactly matching the test.
- `registerIpcHandlers(dependencies)` for studio, pet, local import, sync, friends, hosting, and pet renderer events.
- `windows/src/preload/index.ts` exposing `window.desktopPet` with typed methods that call `ipcRenderer.invoke` or `send`.
- `windows/src/main/app.ts` creating settings, colony, studio controller, tray controller, sleep coordinator, and registering `powerMonitor` suspend/resume.

- [ ] **Step 4: Run IPC test and typecheck**

Run:

```bash
cd windows
npm test tests/ipc-contract.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit IPC and bootstrap**

Run:

```bash
git add windows/tests/ipc-contract.test.ts windows/src/main/ipc.ts windows/src/main/app.ts windows/src/preload/index.ts
git commit -m "feat: wire windows electron ipc"
```

## Task 10: Pet Renderer And Chroma Key

**Files:**
- Create: `windows/tests/chroma-key.test.ts`
- Create: `windows/src/renderer/pet/chroma-key.ts`
- Create: `windows/src/renderer/pet/PetWindow.tsx`
- Modify: `windows/src/renderer/pet-main.tsx`
- Modify: `windows/src/renderer/styles.css`

- [ ] **Step 1: Write failing chroma-key tests**

Add `windows/tests/chroma-key.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { chromaKeyPixel } from "../src/renderer/pet/chroma-key.ts";

test("keys out strongly green pixels", () => {
  const pixel = chromaKeyPixel({ red: 0.1, green: 0.95, blue: 0.1, alpha: 1 });

  assert.ok(pixel.alpha < 0.1);
  assert.ok(pixel.green < 0.95);
});

test("keeps non-green pixels opaque", () => {
  const pixel = chromaKeyPixel({ red: 0.8, green: 0.4, blue: 0.2, alpha: 1 });

  assert.equal(pixel.alpha, 1);
  assert.equal(pixel.red, 0.8);
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
cd windows
npm test tests/chroma-key.test.ts
```

Expected: FAIL with module-not-found for `../src/renderer/pet/chroma-key.ts`.

- [ ] **Step 3: Implement chroma-key functions and PetWindow component**

Implement `chromaKeyPixel`, `processChromaKeyFrame`, and a `PetWindow` component that:

- receives playback commands from `window.desktopPet.onPetCommand`.
- loads local video paths into a muted `<video>`.
- draws aspect-fit frames into a transparent canvas.
- sends `petPlaybackEnded` for one-shot videos.
- sends `petClick` and `petDragBy` events through preload.

- [ ] **Step 4: Wire renderer entry**

Replace `windows/src/renderer/pet-main.tsx` with a root that renders `<PetWindow />`.

- [ ] **Step 5: Run chroma-key test and typecheck**

Run:

```bash
cd windows
npm test tests/chroma-key.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 6: Commit pet renderer**

Run:

```bash
git add windows/tests/chroma-key.test.ts windows/src/renderer/pet/chroma-key.ts windows/src/renderer/pet/PetWindow.tsx windows/src/renderer/pet-main.tsx windows/src/renderer/styles.css
git commit -m "feat: render windows desktop pets"
```

## Task 11: Studio Renderer

**Files:**
- Create: `windows/src/renderer/studio/StudioApp.tsx`
- Modify: `windows/src/renderer/main.tsx`
- Modify: `windows/src/renderer/styles.css`

- [ ] **Step 1: Add StudioApp component**

Add `StudioApp` with:

- Signed-out email/password login panel.
- Signed-in account summary, sync, and sign-out controls.
- Synced pet cards with select and recall.
- Friend list with refresh, add by email, delete, and host selected pet.
- Local pet/material area with pet selector, add, rename, grouped slot rows, import/remove buttons, and status text.

Use icons only where available in text-free contexts; keep the UI compact and utilitarian.

- [ ] **Step 2: Wire studio renderer**

Replace bootstrap UI in `windows/src/renderer/main.tsx` with `<StudioApp />`.

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd windows
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit studio renderer**

Run:

```bash
git add windows/src/renderer/studio/StudioApp.tsx windows/src/renderer/main.tsx windows/src/renderer/styles.css
git commit -m "feat: add windows desktop studio"
```

## Task 12: Documentation And End-To-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add a Windows section that explains:

````markdown
## Run Windows Client

```bash
cd windows
npm install
npm run dev
```

Use the Windows tray icon to open the material studio, import an `idle_loop` MP4 or MOV, toggle click-through, and sync web-generated pets with the same demo credentials used by the web studio.
````

- [ ] **Step 2: Run automated verification**

Run:

```bash
cd windows
npm test
npm run typecheck
```

Expected: all Node tests pass and TypeScript reports no errors.

- [ ] **Step 3: Start Electron client for smoke verification**

Run:

```bash
cd windows
npm run dev
```

Expected:

- Studio window opens.
- Tray icon appears.
- No renderer console errors on launch.
- App can be quit from the tray.

- [ ] **Step 4: Manual Windows behavior verification**

On Windows, verify:

- Tray menu contains all Mac-parity labels.
- Importing an `idle_loop` video opens a transparent always-on-top pet window.
- The green background is removed in the pet canvas.
- Clicking triggers one-shot reaction if a reaction slot exists.
- Dragging moves the pet and persists position.
- Click-through allows mouse events to pass to apps behind the pet.
- Mouseover catch triggers when enabled and a catch slot exists.
- Sleep/wake resumes playback after Windows resume.
- Multiple pets can be shown, moved, resized, and hidden independently.
- Login, sync, friends, hosting request, and recall call the existing web APIs.
- Restart restores visibility, position, size, names, click-through, mouseover setting, local videos, and synced cards.

- [ ] **Step 5: Commit docs and verification note**

Run:

```bash
git add README.md
git commit -m "docs: add windows client instructions"
```

## Plan Self-Review

Spec coverage:

- Electron + React + TypeScript app: Task 1.
- Mac-compatible material slots and size choices: Task 2.
- Mac-compatible state machine: Task 3.
- JSON persistence for pet count, names, frames, sizes, videos, and account session: Task 4.
- Video import rules: Task 5.
- Desktop sync, friends, hosting, recall, replacement warning, and displayable filtering: Task 6.
- Sleep/wake and compact studio derived state: Task 7.
- Tray, pet windows, multi-pet colony, click-through, resize, reset, and playback commands: Tasks 8 and 9.
- Chroma-key pet rendering and drag/click renderer events: Task 10.
- Compact studio UI: Task 11.
- README, automated checks, and Windows smoke verification: Task 12.

Completion-marker scan:

- The plan contains no unresolved markers or unspecified task owners.
- Commands, paths, and expected results are explicit.
- Large UI/controller tasks specify exact files, expected behaviors, and verification commands.

Type consistency:

- Slot ids use `PetActionSlot` from `windows/src/shared/pet-action-slots.ts`.
- State names use `PetState` from `windows/src/shared/pet-state-machine.ts`.
- Settings use `Rect` and `DesktopAccountSession` from `windows/src/shared/settings-store.ts`.
- IPC names are centralized in `ipcChannels` and referenced by preload and renderers.
