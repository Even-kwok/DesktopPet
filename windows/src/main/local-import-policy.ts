import path from "node:path";
import type { PetActionSlot } from "../shared/pet-action-slots.ts";

export type LocalVideoRemovalAction = "showAll" | "refreshPlayback";

const supportedLocalVideoExtensions = ["mp4", "mov", "m4v"] as const;

export type FirstRunIdleLoopPromptInput = {
  showsFirstRunPrompt: boolean;
  didRestoreVideo: boolean;
  hasFirstPetIdleLoop: boolean;
};

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
    filters: [{ name: "Video", extensions: [...supportedLocalVideoExtensions] }]
  };
}

export function firstRunIdleLoopPromptPlan(input: FirstRunIdleLoopPromptInput) {
  if (!input.showsFirstRunPrompt || input.didRestoreVideo || input.hasFirstPetIdleLoop) {
    return { shouldPrompt: false as const };
  }

  return { shouldPrompt: true as const, petIndex: 0, slot: "idle_loop" as const };
}

export function firstRunIdleLoopPromptOptions() {
  return {
    type: "info" as const,
    buttons: ["选择待机循环", "稍后"],
    defaultId: 0,
    cancelId: 1,
    message: "CatDesktopPet is running",
    detail: "请选择一个待机循环绿幕 MP4 或 MOV，宠物才会显示在桌面上。其他状态视频可以稍后从「选择状态视频」里添加。"
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

export function isSupportedLocalVideoPath(filePath: string) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return supportedLocalVideoExtensions.some((supportedExtension) => extension === supportedExtension);
}
