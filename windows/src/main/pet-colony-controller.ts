import type { Rect, SettingsStore } from "../shared/settings-store.ts";

export type PetWindowControllerLike = {
  isVisible: boolean;
  frame?: Rect;
  show: () => boolean;
  hide: () => void;
  setClickThrough: (isClickThrough: boolean) => void;
  setSizeScale: (scale: number) => void;
  refreshPlayback: () => void;
  prepareForSystemSleep: () => void;
  resumeAfterSystemWake: () => void;
  refreshDisplayName: () => void;
  resetPosition: () => void;
};

export type PetWindowFactory = (petIndex: number) => PetWindowControllerLike;

export class PetColonyController {
  readonly #settingsStore: SettingsStore;
  readonly #makePetWindow: PetWindowFactory;
  readonly #petControllers: PetWindowControllerLike[] = [];

  constructor(settingsStore: SettingsStore, makePetWindow: PetWindowFactory) {
    this.#settingsStore = settingsStore;
    this.#makePetWindow = makePetWindow;
    this.#ensurePetControllers(settingsStore.petCount);
  }

  get isVisible() {
    return this.#activePetControllers().some((controller) => controller.isVisible);
  }

  get petCount() {
    return this.#settingsStore.petCount;
  }

  setPetCount(count: number) {
    const newCount = Math.max(0, Math.trunc(count));
    this.#ensurePetControllers(newCount);
    this.#settingsStore.petCount = newCount;

    this.#inactivePetControllers().forEach((controller) => controller.hide());

    if (this.#settingsStore.isPetVisible) {
      this.showAll();
    }
  }

  addPet() {
    const newPetIndex = this.#settingsStore.petCount;
    this.setPetCount(this.#settingsStore.petCount + 1);
    return newPetIndex;
  }

  removePet(index: number) {
    const currentCount = this.#settingsStore.petCount;
    if (currentCount <= 0 || index < 0 || index >= currentCount) {
      return this.isVisible;
    }

    this.#ensurePetControllers(currentCount);

    this.#petControllers.slice(index).forEach((controller) => controller.hide());
    this.#settingsStore.removePet(index);

    if (!this.#settingsStore.isPetVisible) {
      return false;
    }

    return this.showAll();
  }

  showAll() {
    this.#ensurePetControllers(this.#settingsStore.petCount);

    let didShowAnyPet = false;
    this.#activePetControllers().forEach((controller) => {
      if (controller.show()) {
        didShowAnyPet = true;
      }
    });
    this.#inactivePetControllers().forEach((controller) => controller.hide());

    return didShowAnyPet;
  }

  hideAll() {
    this.#ensurePetControllers(this.#settingsStore.petCount);
    this.#petControllers.forEach((controller) => controller.hide());
  }

  setClickThrough(isClickThrough: boolean) {
    this.#ensurePetControllers(this.#settingsStore.petCount);
    this.#petControllers.forEach((controller) => controller.setClickThrough(isClickThrough));
  }

  setPetSizeScale(scale: number, petIndex: number) {
    if (petIndex < 0 || petIndex >= this.#settingsStore.petCount) {
      return;
    }

    this.#ensurePetControllers(petIndex + 1);
    this.#settingsStore.setPetSizeScale(scale, petIndex);
    this.#petControllers[petIndex].setSizeScale(scale);
  }

  refreshPlayback() {
    this.#activePetControllers().forEach((controller) => controller.refreshPlayback());
  }

  prepareForSystemSleep() {
    this.#activePetControllers().forEach((controller) => controller.prepareForSystemSleep());
  }

  resumeAfterSystemWake() {
    if (!this.#settingsStore.isPetVisible) {
      return false;
    }

    const didShowAnyPet = this.showAll();
    this.#settingsStore.isPetVisible = didShowAnyPet;
    this.#activePetControllers().forEach((controller) => controller.resumeAfterSystemWake());
    return didShowAnyPet;
  }

  refreshDisplayNames() {
    this.#activePetControllers().forEach((controller) => controller.refreshDisplayName());
  }

  resetPositions() {
    this.#activePetControllers().forEach((controller) => controller.resetPosition());
  }

  #ensurePetControllers(count: number) {
    while (this.#petControllers.length < count) {
      this.#petControllers.push(this.#makePetWindow(this.#petControllers.length));
    }
  }

  #activePetControllers() {
    this.#ensurePetControllers(this.#settingsStore.petCount);
    return this.#petControllers.slice(0, this.#settingsStore.petCount);
  }

  #inactivePetControllers() {
    this.#ensurePetControllers(this.#settingsStore.petCount);
    return this.#petControllers.slice(this.#settingsStore.petCount);
  }
}
