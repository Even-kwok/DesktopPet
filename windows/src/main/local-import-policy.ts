import type { PetActionSlot } from "../shared/pet-action-slots.ts";

export type LocalVideoRemovalAction = "showAll" | "refreshPlayback";

export function petCountAfterLocalVideoImport(
  currentPetCount: number,
  petIndex: number,
  slot: PetActionSlot
) {
  const currentCount = Math.max(0, Math.trunc(currentPetCount));
  const targetPetIndex = Math.trunc(petIndex);
  if (slot !== "idle_loop" || targetPetIndex < 0) {
    return currentCount;
  }

  return Math.max(currentCount, targetPetIndex + 1);
}

export function localVideoRemovalAction(
  slot: PetActionSlot,
  isPetVisible: boolean
): LocalVideoRemovalAction {
  return slot === "idle_loop" && isPetVisible ? "showAll" : "refreshPlayback";
}
