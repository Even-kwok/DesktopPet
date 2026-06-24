import type { Rect, SettingsStore } from "../shared/settings-store.ts";
import { matchingNearbyResponseSlot, nearbyPetInteractionSlots } from "../shared/pet-action-slots.ts";
import type { PetActionSlot, PetInteractionSide } from "../shared/pet-action-slots.ts";

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
  bringToFront?: () => void;
  refreshDisplayName: () => void;
  resetPosition: () => void;
  dragBy?: (delta: { x: number; y: number }) => void;
  click?: () => void;
  playbackEnded?: () => void;
  dragStarted?: () => void;
  dragEnded?: () => void;
  randomNearbyPetInteractionSlot?: (side: PetInteractionSide) => PetActionSlot | undefined;
  triggerNearbyPetInteraction?: (slot: PetActionSlot) => boolean;
};

export type PetWindowFactory = (petIndex: number) => PetWindowControllerLike;
type ProximityTimer = ReturnType<typeof setInterval>;

export type PetColonyControllerOptions = {
  proximityCheckIntervalMs?: number;
  proximityInteractionCooldownMs?: number;
  proximityInteractionProbability?: number;
  proximityMargin?: number;
  random?: () => number;
  now?: () => number;
  scheduleProximityCheck?: (callback: () => void, intervalMs: number) => ProximityTimer;
  clearProximityCheck?: (timer: ProximityTimer) => void;
};

export class PetColonyController {
  readonly #settingsStore: SettingsStore;
  readonly #makePetWindow: PetWindowFactory;
  readonly #options: Required<PetColonyControllerOptions>;
  readonly #petControllers: PetWindowControllerLike[] = [];
  readonly #lastProximityInteractionAt = new Map<number, number>();
  #proximityInteractionTimer?: ProximityTimer;

  constructor(
    settingsStore: SettingsStore,
    makePetWindow: PetWindowFactory,
    options: PetColonyControllerOptions = {}
  ) {
    this.#settingsStore = settingsStore;
    this.#makePetWindow = makePetWindow;
    this.#options = {
      proximityCheckIntervalMs: options.proximityCheckIntervalMs ?? 6000,
      proximityInteractionCooldownMs: options.proximityInteractionCooldownMs ?? 24000,
      proximityInteractionProbability: options.proximityInteractionProbability ?? 0.18,
      proximityMargin: options.proximityMargin ?? 28,
      random: options.random ?? Math.random,
      now: options.now ?? Date.now,
      scheduleProximityCheck: options.scheduleProximityCheck ?? setInterval,
      clearProximityCheck: options.clearProximityCheck ?? clearInterval
    };
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
    } else {
      this.#updateProximityInteractionTimer();
    }
  }

  addPet() {
    const newPetIndex = this.#settingsStore.petCount;
    this.setPetCount(this.#settingsStore.petCount + 1);
    return newPetIndex;
  }

  removePet(index: number) {
    const currentCount = this.#settingsStore.petCount;
    if (currentCount <= 0 || !isExistingPetIndex(index, currentCount)) {
      return this.isVisible;
    }

    this.#ensurePetControllers(currentCount);

    this.#petControllers.slice(index).forEach((controller) => controller.hide());
    this.#settingsStore.removePet(index);

    if (!this.#settingsStore.isPetVisible) {
      this.#updateProximityInteractionTimer();
      return false;
    }

    const didShowAnyPet = this.showAll();
    this.#lastProximityInteractionAt.clear();
    this.#updateProximityInteractionTimer();
    return didShowAnyPet;
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
    this.#updateProximityInteractionTimer();

    return didShowAnyPet;
  }

  hideAll() {
    this.#ensurePetControllers(this.#settingsStore.petCount);
    this.#petControllers.forEach((controller) => controller.hide());
    this.#stopProximityInteractionTimer();
  }

  bringToFront() {
    this.#activePetControllers().forEach((controller) => controller.bringToFront?.());
  }

  setClickThrough(isClickThrough: boolean) {
    this.#ensurePetControllers(this.#settingsStore.petCount);
    this.#petControllers.forEach((controller) => controller.setClickThrough(isClickThrough));
  }

  setPetSizeScale(scale: number, petIndex: number) {
    if (!isExistingPetIndex(petIndex, this.#settingsStore.petCount)) {
      return;
    }

    this.#ensurePetControllers(petIndex + 1);
    this.#settingsStore.setPetSizeScale(scale, petIndex);
    this.#petControllers[petIndex].setSizeScale(this.#settingsStore.petSizeScale(petIndex));
    this.#updateProximityInteractionTimer();
  }

  refreshPlayback() {
    this.#activePetControllers().forEach((controller) => controller.refreshPlayback());
  }

  prepareForSystemSleep() {
    this.#stopProximityInteractionTimer();
    this.#activePetControllers().forEach((controller) => controller.prepareForSystemSleep());
  }

  resumeAfterSystemWake() {
    if (!this.#settingsStore.isPetVisible) {
      this.#stopProximityInteractionTimer();
      return false;
    }

    const didShowAnyPet = this.showAll();
    this.#settingsStore.isPetVisible = didShowAnyPet;
    this.#activePetControllers().forEach((controller) => controller.resumeAfterSystemWake());
    this.#updateProximityInteractionTimer();
    return didShowAnyPet;
  }

  refreshDisplayNames() {
    this.#activePetControllers().forEach((controller) => controller.refreshDisplayName());
  }

  resetPositions() {
    this.#activePetControllers().forEach((controller) => controller.resetPosition());
    this.#updateProximityInteractionTimer();
  }

  dragPetStarted(petIndex: number) {
    this.#petControllers[petIndex]?.dragStarted?.();
  }

  dragPetBy(petIndex: number, delta: { x: number; y: number }) {
    this.#petControllers[petIndex]?.dragBy?.(delta);
    this.#updateProximityInteractionTimer();
  }

  dragPetEnded(petIndex: number) {
    this.#petControllers[petIndex]?.dragEnded?.();
    this.#updateProximityInteractionTimer();
  }

  clickPet(petIndex: number) {
    this.#petControllers[petIndex]?.click?.();
  }

  petPlaybackEnded(petIndex: number) {
    this.#petControllers[petIndex]?.playbackEnded?.();
  }

  checkNearbyPetInteractions() {
    const visibleControllers = this.#activePetControllers()
      .map((controller, index) => ({ controller, index }))
      .filter(({ controller }) => controller.isVisible && controller.frame !== undefined);

    if (visibleControllers.length < 2) {
      this.#updateProximityInteractionTimer();
      return;
    }

    for (let firstOffset = 0; firstOffset < visibleControllers.length - 1; firstOffset += 1) {
      for (let secondOffset = firstOffset + 1; secondOffset < visibleControllers.length; secondOffset += 1) {
        const first = visibleControllers[firstOffset];
        const second = visibleControllers[secondOffset];
        if (!first.controller.frame || !second.controller.frame) {
          continue;
        }

        if (!arePetsClose(first.controller.frame, second.controller.frame, this.#options.proximityMargin)) {
          continue;
        }

        if (this.#options.random() > this.#options.proximityInteractionProbability) {
          continue;
        }

        const firstCenterX = first.controller.frame.x + first.controller.frame.width / 2;
        const secondCenterX = second.controller.frame.x + second.controller.frame.width / 2;
        const sideForFirst = secondCenterX < firstCenterX ? "left" : "right";
        const sideForSecond = firstCenterX < secondCenterX ? "left" : "right";

        if (this.#options.random() < 0.5) {
          this.#tryTriggerPairedProximityInteraction(first, sideForFirst, second);
        } else {
          this.#tryTriggerPairedProximityInteraction(second, sideForSecond, first);
        }
      }
    }
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

  #tryTriggerPairedProximityInteraction(
    initiator: { controller: PetWindowControllerLike; index: number },
    initiatorSide: PetInteractionSide,
    responder: { controller: PetWindowControllerLike; index: number }
  ) {
    if (this.#isInProximityCooldown(initiator.index)) {
      return;
    }

    const initiatorSlot =
      initiator.controller.randomNearbyPetInteractionSlot?.(initiatorSide) ??
      randomSlot(nearbyPetInteractionSlots(initiatorSide), this.#options.random);
    if (!initiator.controller.triggerNearbyPetInteraction?.(initiatorSlot)) {
      return;
    }

    this.#lastProximityInteractionAt.set(initiator.index, this.#options.now());
    const responseSlot = matchingNearbyResponseSlot(initiatorSlot);
    if (responseSlot && responder.controller.triggerNearbyPetInteraction?.(responseSlot)) {
      this.#lastProximityInteractionAt.set(responder.index, this.#options.now());
    }
  }

  #isInProximityCooldown(petIndex: number) {
    const lastInteractionAt = this.#lastProximityInteractionAt.get(petIndex);
    return lastInteractionAt !== undefined && this.#options.now() - lastInteractionAt < this.#options.proximityInteractionCooldownMs;
  }

  #updateProximityInteractionTimer() {
    if (this.#activePetControllers().filter((controller) => controller.isVisible).length > 1) {
      this.#startProximityInteractionTimer();
    } else {
      this.#stopProximityInteractionTimer();
    }
  }

  #startProximityInteractionTimer() {
    if (this.#proximityInteractionTimer) {
      return;
    }

    this.#proximityInteractionTimer = this.#options.scheduleProximityCheck(() => {
      this.checkNearbyPetInteractions();
    }, this.#options.proximityCheckIntervalMs);
    this.#proximityInteractionTimer.unref?.();
  }

  #stopProximityInteractionTimer() {
    if (this.#proximityInteractionTimer) {
      this.#options.clearProximityCheck(this.#proximityInteractionTimer);
      this.#proximityInteractionTimer = undefined;
    }
  }
}

function arePetsClose(first: Rect, second: Rect, margin: number) {
  return !(
    first.x - margin > second.x + second.width ||
    first.x + first.width + margin < second.x ||
    first.y - margin > second.y + second.height ||
    first.y + first.height + margin < second.y
  );
}

function randomSlot<T>(slots: T[], random: () => number) {
  return slots[Math.min(slots.length - 1, Math.floor(random() * slots.length))];
}

function isExistingPetIndex(index: number, petCount: number) {
  return Number.isInteger(index) && index >= 0 && index < petCount;
}
