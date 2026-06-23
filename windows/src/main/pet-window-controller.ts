import { BrowserWindow } from "electron";
import type { Rectangle } from "electron";
import type { Rect, SettingsStore } from "../shared/settings-store.ts";
import { applyPetSizeScale, defaultPetFrame } from "../shared/settings-store.ts";
import { PetStateMachine } from "../shared/pet-state-machine.ts";
import type { PetWindowControllerLike } from "./pet-colony-controller.ts";
import type { PetActionSlot } from "../shared/pet-action-slots.ts";

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
    this.frame = this.#settingsStore.petFrame(this.#petIndex);
    this.#currentVideoPath = idleVideoPath;
    this.#currentMode = "loop";
    void this.#showWindow();
    this.#stateMachine.send("show");
    return true;
  }

  hide() {
    this.isVisible = false;
    this.#window?.hide();
    this.#stateMachine.send("hide");
  }

  setClickThrough(isClickThrough: boolean) {
    this.#window?.setIgnoreMouseEvents(isClickThrough, { forward: true });
  }

  setSizeScale(scale: number) {
    this.#settingsStore.setPetSizeScale(scale, this.#petIndex);
    this.frame = this.#settingsStore.petFrame(this.#petIndex);
    if (this.#window) {
      this.#window.setBounds(this.#rectToBounds(this.frame));
    }
  }

  refreshPlayback() {
    this.#applyState(this.#stateMachine.state);
  }

  prepareForSystemSleep() {
    this.#sendCommand({ type: "pause" });
  }

  resumeAfterSystemWake() {
    if (this.isVisible) {
      this.show();
    }
  }

  refreshDisplayName() {}

  resetPosition() {
    const frame = applyPetSizeScale(
      defaultPetFrame(this.#petIndex, { width: 1024, height: 768 }),
      this.#settingsStore.petSizeScale(this.#petIndex)
    );
    this.#settingsStore.setPetFrame(frame, this.#petIndex);
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

  click() {
    this.#stateMachine.send("click");
  }

  playbackEnded() {
    this.#stateMachine.send("reactionFinished");
  }

  async #showWindow() {
    const window = this.#window ?? this.#createWindow();
    await this.#loadRenderer(window);
    window.setBounds(this.#rectToBounds(this.#settingsStore.petFrame(this.#petIndex)));
    window.setIgnoreMouseEvents(this.#options.getClickThrough(), { forward: true });
    window.showInactive();
    window.moveTop();
    this.#sendCurrentVideo();
  }

  #createWindow() {
    const frame = this.#settingsStore.petFrame(this.#petIndex);
    const window = new BrowserWindow({
      ...this.#rectToBounds(frame),
      transparent: true,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: this.#options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

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
    if (window.webContents.getURL()) {
      return;
    }

    if (this.#options.petRendererURL) {
      await window.loadURL(new URL("pet.html", withTrailingSlash(this.#options.petRendererURL)).toString());
    } else {
      await window.loadFile(this.#options.petRendererFile);
    }
  }

  #applyState(state: string) {
    if (state === "hidden") {
      this.#sendCommand({ type: "pause" });
      return;
    }

    if (state === "clicked") {
      this.#playFirstAvailable(["click_react", "happy", "disgusted", "clingy", "aloof", "belly_up"]);
      return;
    }

    if (state === "idle") {
      const idleVideoPath = this.#settingsStore.restoreVideoPath("idle_loop", this.#petIndex);
      if (idleVideoPath) {
        this.#currentVideoPath = idleVideoPath;
        this.#currentMode = "loop";
        this.#sendCurrentVideo();
      }
    }
  }

  #playFirstAvailable(slots: PetActionSlot[]) {
    const slot = slots.find((candidate) =>
      this.#settingsStore.restoreVideoPath(candidate, this.#petIndex)
    );
    if (!slot) {
      this.#stateMachine.send("reactionFinished");
      return;
    }

    this.#currentVideoPath = this.#settingsStore.restoreVideoPath(slot, this.#petIndex);
    this.#currentMode = "playOnce";
    this.#sendCurrentVideo();
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
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
