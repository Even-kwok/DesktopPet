import type { PetActionSlot } from "../shared/pet-action-slots.ts";

export type LocalVideoRemovalAction = "showAll" | "refreshPlayback";

export function idleLoopImportTargetAfterAddingPet(petIndex: number) {
  return {
    petIndex: Math.max(0, Math.trunc(petIndex)),
    slot: "idle_loop" as const
  };
}

export function localVideoPickerOptions(petName: string, slotName: string) {
  return {
    title: `选择 ${petName} 的「${slotName}」视频`,
    buttonLabel: "选择",
    properties: ["openFile"] as Array<"openFile">,
    filters: [{ name: "Video", extensions: ["mp4", "mov"] }]
  };
}

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
