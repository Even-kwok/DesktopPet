import { BrowserWindow, screen } from "electron";
import type { Rectangle } from "electron";
import type { Rect, SettingsStore } from "../shared/settings-store.ts";
import { PetStateMachine } from "../shared/pet-state-machine.ts";
import type { PetWindowControllerLike } from "./pet-colony-controller.ts";
import {
  petFrameForScreen,
  resetPetFrameForScreen,
  setPetSizeScaleForScreen
} from "./pet-window-frame.ts";
import {
  clickReactionSlots,
  idleRandomActionSlots,
  mouseoverCatchSlots,
  nearbyPetInteractionSlots
} from "../shared/pet-action-slots.ts";
import {
  hasLoadedRendererURL,
  nextRendererShowRevision,
  shouldFinishRendererShow
} from "./renderer-load-policy.ts";
import { petWindowBrowserOptions } from "./electron-window-options.ts";
import { planPetWindowWakeResume } from "./pet-window-wake-policy.ts";
import type { PetActionSlot, PetInteractionSide } from "../shared/pet-action-slots.ts";

export type PetWindowControllerOptions = {
  preloadPath: string;
  petRendererURL?: string;
  petRendererFile: string;
  getClickThrough: () => boolean;
};

export class PetWindowController implements PetWindowControllerLike {
  readonly #settingsStore: SettingsStore;
  readonly #petIndex: number;
  readonly #options: PetWindowControllerOptions;
  readonly #stateMachine = new PetStateMachine((state) => this.#applyState(state));
  #window?: BrowserWindow;
  #currentVideoPath?: string;
  #currentMode: "loop" | "playOnce" = "loop";
  #mouseMonitorTimer?: NodeJS.Timeout;
  #sleepTimer?: NodeJS.Timeout;
  #idleActionTimer?: NodeJS.Timeout;
  #pendingSocialInteractionSlots?: PetActionSlot[];
  #wasMouseInsideCatchFrame = false;
  #showRevision = 0;
  isVisible = false;
  frame?: Rect;

  constructor(settingsStore: SettingsStore, petIndex: number, options: PetWindowControllerOptions) {
    this.#settingsStore = settingsStore;
    this.#petIndex = petIndex;
    this.#options = options;
  }

  show() {
    const idleVideoPath = this.#settingsStore.restoreVideoPath("idle_loop", this.#petIndex);
    if (!idleVideoPath) {
      this.hide();
      return false;
    }

    this.isVisible = true;
    this.frame = this.#petFrameForCurrentScreen();
    this.#currentVideoPath = idleVideoPath;
    this.#currentMode = "loop";
    const showRevision = this.#nextShowRevision();
    void this.#showWindow(showRevision);
    this.#stateMachine.send("show");
    return true;
  }

  hide() {
    this.#nextShowRevision();
    this.isVisible = false;
    this.#window?.hide();
    this.#stateMachine.send("hide");
  }

  setClickThrough(isClickThrough: boolean) {
    this.#window?.setIgnoreMouseEvents(isClickThrough, { forward: true });
  }

  setSizeScale(scale: number) {
    this.frame = setPetSizeScaleForScreen(this.#settingsStore, this.#petIndex, scale, this.#currentScreenSize());
    if (this.#window) {
      this.#window.setBounds(this.#rectToBounds(this.frame));
    }
  }

  refreshPlayback() {
    this.#applyState(this.#stateMachine.state);
  }

  prepareForSystemSleep() {
    this.#stopMouseMonitor();
    this.#stopSleepTimer();
    this.#stopIdleActionTimer();
    this.#sendCommand({ type: "pause" });
  }

  resumeAfterSystemWake() {
    const plan = planPetWindowWakeResume({
      isVisible: this.isVisible
    });
    if (!plan.shouldShowWindow) {
      return;
    }

    const showRevision = this.#nextShowRevision();
    void this.#showWindow(showRevision);
    if (plan.shouldReplayCurrentState) {
      this.#applyState(this.#stateMachine.state);
    }
  }

  bringToFront() {
    if (!this.isVisible || !this.#window) {
      return;
    }

    this.#window.showInactive();
    this.#window.moveTop();
  }

  refreshDisplayName() {
    this.#window?.setTitle(this.#windowTitle());
  }

  resetPosition() {
    const frame = resetPetFrameForScreen(this.#settingsStore, this.#petIndex, this.#currentScreenSize());
    this.frame = frame;
    this.#window?.setBounds(this.#rectToBounds(frame));
  }

  dragBy(delta: { x: number; y: number }) {
    if (!this.#window) {
      return;
    }

    const bounds = this.#window.getBounds();
    const nextBounds = {
      ...bounds,
      x: bounds.x + Math.round(delta.x),
      y: bounds.y + Math.round(delta.y)
    };
    this.#window.setBounds(nextBounds);
    this.#saveBounds(nextBounds);
  }

  dragStarted() {
    this.#stateMachine.send("dragStarted");
  }

  dragEnded() {
    this.#stateMachine.send("dragEnded");
  }

  click() {
    this.#stateMachine.send("click");
  }

  playbackEnded() {
    this.#stateMachine.send("reactionFinished");
  }

  randomNearbyPetInteractionSlot(side: PetInteractionSide) {
    return this.#randomAvailableSlot(nearbyPetInteractionSlots(side));
  }

  triggerNearbyPetInteraction(slot: PetActionSlot) {
    if (this.#stateMachine.state !== "idle" || !this.#settingsStore.restoreVideoPath(slot, this.#petIndex)) {
      return false;
    }

    this.#pendingSocialInteractionSlots = [slot];
    this.#stateMachine.send("nearbyPet");
    return true;
  }

  async #showWindow(showRevision: number) {
    const window = this.#window ?? this.#createWindow();
    await this.#loadRenderer(window);
    if (
      !shouldFinishRendererShow({
        requestRevision: showRevision,
        currentRevision: this.#showRevision,
        isVisible: this.isVisible
      })
    ) {
      return;
    }

    window.setBounds(this.#rectToBounds(this.#petFrameForCurrentScreen()));
    window.setIgnoreMouseEvents(this.#options.getClickThrough(), { forward: true });
    window.showInactive();
    window.moveTop();
    this.#sendCurrentVideo();
  }

  #createWindow() {
    const frame = this.#petFrameForCurrentScreen();
    const window = new BrowserWindow(
      petWindowBrowserOptions({
        bounds: this.#rectToBounds(frame),
        title: this.#windowTitle(),
        preloadPath: this.#options.preloadPath
      })
    );

    window.on("moved", () => this.#saveBounds(window.getBounds()));
    window.on("resized", () => this.#saveBounds(window.getBounds()));
    window.on("closed", () => {
      this.#window = undefined;
      this.isVisible = false;
    });

    this.#window = window;
    return window;
  }

  async #loadRenderer(window: BrowserWindow) {
    if (hasLoadedRendererURL(window.webContents.getURL())) {
      return;
    }

    if (this.#options.petRendererURL) {
      await window.loadURL(this.#options.petRendererURL);
    } else {
      await window.loadFile(this.#options.petRendererFile);
    }
  }

  #nextShowRevision() {
    this.#showRevision = nextRendererShowRevision(this.#showRevision);
    return this.#showRevision;
  }

  #applyState(state: string) {
    if (state === "hidden") {
      this.#stopMouseMonitor();
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#pendingSocialInteractionSlots = undefined;
      this.#sendCommand({ type: "pause" });
      return;
    }

    if (state === "clicked") {
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#playFirstAvailable(clickReactionSlots);
      return;
    }

    if (state === "catchingBug") {
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#playFirstAvailable(mouseoverCatchSlots);
      return;
    }

    if (state === "idleAction") {
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#playFirstAvailable(idleRandomActionSlots);
      return;
    }

    if (state === "socialInteraction") {
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      const slots = this.#pendingSocialInteractionSlots ?? [];
      this.#pendingSocialInteractionSlots = undefined;
      this.#playFirstAvailable(slots);
      return;
    }

    if (state === "sleeping") {
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#playVideo("sleep_loop", "playOnce");
      this.#startMouseMonitor();
      return;
    }

    if (state === "grabbed") {
      this.#stopMouseMonitor();
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#pendingSocialInteractionSlots = undefined;
      this.#playVideo("idle_loop", "loop");
      return;
    }

    if (state === "dropped") {
      this.#stopMouseMonitor();
      this.#stopSleepTimer();
      this.#stopIdleActionTimer();
      this.#pendingSocialInteractionSlots = undefined;
      this.#sendCommand({ type: "playDropBounce" });
      return;
    }

    if (state === "idle") {
      this.#playVideo("idle_loop", "loop");
      this.#startMouseMonitorIfNeeded();
      this.#scheduleSleepTimer();
      this.#scheduleIdleActionTimer();
    }
  }

  #playVideo(slot: PetActionSlot, mode: "loop" | "playOnce") {
    const videoPath = this.#settingsStore.restoreVideoPath(slot, this.#petIndex);
    if (!videoPath) {
      if (slot === "sleep_loop") {
        this.#stateMachine.send("wake");
      }
      return;
    }

    this.#currentVideoPath = videoPath;
    this.#currentMode = mode;
    this.#sendCurrentVideo();
  }

  #playFirstAvailable(slots: PetActionSlot[]) {
    const slot = this.#randomAvailableSlot(slots);
    if (!slot) {
      this.#stateMachine.send("reactionUnavailable");
      return;
    }

    this.#currentVideoPath = this.#settingsStore.restoreVideoPath(slot, this.#petIndex);
    this.#currentMode = "playOnce";
    this.#sendCurrentVideo();
  }

  #randomAvailableSlot(slots: PetActionSlot[]) {
    const availableSlots = slots.filter((slot) => this.#settingsStore.restoreVideoPath(slot, this.#petIndex));
    return availableSlots[Math.floor(Math.random() * availableSlots.length)];
  }

  #hasAvailableSlot(slots: PetActionSlot[]) {
    return slots.some((slot) => this.#settingsStore.restoreVideoPath(slot, this.#petIndex));
  }

  #startMouseMonitorIfNeeded() {
    if (
      this.#settingsStore.restoreVideoPath("sleep_loop", this.#petIndex) ||
      (this.#settingsStore.isMouseoverCatchEnabled && this.#hasAvailableSlot(mouseoverCatchSlots))
    ) {
      this.#startMouseMonitor();
    } else {
      this.#stopMouseMonitor();
    }
  }

  #startMouseMonitor() {
    if (this.#mouseMonitorTimer) {
      return;
    }

    if (this.frame) {
      this.#wasMouseInsideCatchFrame = rectContainsPoint(mouseoverCatchFrame(this.frame), screen.getCursorScreenPoint());
    }

    this.#mouseMonitorTimer = setInterval(() => {
      this.#updateMouseMonitor();
    }, 1000 / 30);
    this.#mouseMonitorTimer.unref?.();
  }

  #stopMouseMonitor() {
    if (this.#mouseMonitorTimer) {
      clearInterval(this.#mouseMonitorTimer);
      this.#mouseMonitorTimer = undefined;
    }
    this.#wasMouseInsideCatchFrame = false;
  }

  #scheduleSleepTimer() {
    this.#stopSleepTimer();
    if (!this.#settingsStore.restoreVideoPath("sleep_loop", this.#petIndex)) {
      return;
    }

    this.#sleepTimer = setTimeout(() => {
      this.#sleepTimer = undefined;
      this.#tryEnterSleep();
    }, 60000);
    this.#sleepTimer.unref?.();
  }

  #stopSleepTimer() {
    if (this.#sleepTimer) {
      clearTimeout(this.#sleepTimer);
      this.#sleepTimer = undefined;
    }
  }

  #scheduleIdleActionTimer() {
    this.#stopIdleActionTimer();
    if (!this.#hasAvailableSlot(idleRandomActionSlots)) {
      return;
    }

    this.#idleActionTimer = setTimeout(() => {
      this.#idleActionTimer = undefined;
      this.#tryPlayIdleRandomAction();
    }, 12000 + Math.random() * 16000);
    this.#idleActionTimer.unref?.();
  }

  #stopIdleActionTimer() {
    if (this.#idleActionTimer) {
      clearTimeout(this.#idleActionTimer);
      this.#idleActionTimer = undefined;
    }
  }

  #tryEnterSleep() {
    if (this.#stateMachine.state !== "idle" || !this.frame || !this.isVisible) {
      return;
    }

    if (rectContainsPoint(expandRect(this.frame, 70), screen.getCursorScreenPoint())) {
      this.#scheduleSleepTimer();
      return;
    }

    this.#stateMachine.send("sleep");
  }

  #tryPlayIdleRandomAction() {
    if (this.#stateMachine.state !== "idle" || !this.frame || !this.isVisible) {
      return;
    }

    if (rectContainsPoint(expandRect(this.frame, 35), screen.getCursorScreenPoint())) {
      this.#scheduleIdleActionTimer();
      return;
    }

    this.#stateMachine.send("idleActionDue");
  }

  #updateMouseMonitor() {
    if (!this.frame || !this.isVisible) {
      return;
    }

    const cursorPoint = screen.getCursorScreenPoint();
    if (this.#stateMachine.state === "sleeping") {
      if (rectContainsPoint(expandRect(this.frame, 35), cursorPoint)) {
        this.#wasMouseInsideCatchFrame = rectContainsPoint(mouseoverCatchFrame(this.frame), cursorPoint);
        this.#stateMachine.send("wake");
      }
      return;
    }

    const isInsideCatchFrame = rectContainsPoint(mouseoverCatchFrame(this.frame), cursorPoint);
    if (!isInsideCatchFrame) {
      this.#wasMouseInsideCatchFrame = false;
      return;
    }

    if (this.#wasMouseInsideCatchFrame) {
      return;
    }

    this.#wasMouseInsideCatchFrame = true;
    if (
      this.#stateMachine.state === "idle" &&
      this.#settingsStore.isMouseoverCatchEnabled &&
      this.#hasAvailableSlot(mouseoverCatchSlots)
    ) {
      this.#stateMachine.send("mouseOverPet");
    }
  }

  #sendCurrentVideo() {
    if (!this.#currentVideoPath) {
      return;
    }

    this.#sendCommand({
      type: "loadVideo",
      petIndex: this.#petIndex,
      videoPath: this.#currentVideoPath,
      mode: this.#currentMode
    });
  }

  #sendCommand(command: unknown) {
    this.#window?.webContents.send("pet:command", command);
  }

  #saveBounds(bounds: Rectangle) {
    const frame = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    this.frame = frame;
    this.#settingsStore.setPetFrame(frame, this.#petIndex);
  }

  #rectToBounds(rect: Rect) {
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  #windowTitle() {
    return `CatDesktopPet - ${this.#settingsStore.petName(this.#petIndex)}`;
  }

  #petFrameForCurrentScreen() {
    return petFrameForScreen(this.#settingsStore, this.#petIndex, this.#currentScreenSize());
  }

  #currentScreenSize() {
    return screen.getPrimaryDisplay().workArea;
  }
}

function mouseoverCatchFrame(frame: Rect) {
  return expandRect(frame, 10);
}

function expandRect(frame: Rect, margin: number): Rect {
  return {
    x: frame.x - margin,
    y: frame.y - margin,
    width: frame.width + margin * 2,
    height: frame.height + margin * 2
  };
}

function rectContainsPoint(rect: Rect, point: { x: number; y: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
