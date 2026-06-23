import type { Rect, SettingsStore } from "../shared/settings-store.ts";
import { PetStateMachine } from "../shared/pet-state-machine.ts";
import type { PetWindowControllerLike } from "./pet-colony-controller.ts";

export class PetWindowController implements PetWindowControllerLike {
  readonly #settingsStore: SettingsStore;
  readonly #petIndex: number;
  readonly #stateMachine = new PetStateMachine();
  isVisible = false;
  frame?: Rect;

  constructor(settingsStore: SettingsStore, petIndex: number) {
    this.#settingsStore = settingsStore;
    this.#petIndex = petIndex;
  }

  show() {
    const idleVideoPath = this.#settingsStore.restoreVideoPath("idle_loop", this.#petIndex);
    if (!idleVideoPath) {
      this.hide();
      return false;
    }

    this.isVisible = true;
    this.frame = this.#settingsStore.petFrame(this.#petIndex);
    this.#stateMachine.send("show");
    return true;
  }

  hide() {
    this.isVisible = false;
    this.#stateMachine.send("hide");
  }

  setClickThrough(_: boolean) {}

  setSizeScale(scale: number) {
    this.#settingsStore.setPetSizeScale(scale, this.#petIndex);
    this.frame = this.#settingsStore.petFrame(this.#petIndex);
  }

  refreshPlayback() {}
  prepareForSystemSleep() {}

  resumeAfterSystemWake() {
    if (this.isVisible) {
      this.show();
    }
  }

  refreshDisplayName() {}

  resetPosition() {
    this.frame = undefined;
  }
}
