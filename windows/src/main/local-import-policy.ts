import type { PetActionSlot } from "../shared/pet-action-slots.ts";

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
