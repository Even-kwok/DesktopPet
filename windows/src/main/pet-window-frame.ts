import { applyPetSizeScale, defaultPetFrame } from "../shared/settings-store.ts";
import type { Rect, ScreenArea, SettingsStore } from "../shared/settings-store.ts";

export function petFrameForScreen(settingsStore: SettingsStore, petIndex: number, screenArea: ScreenArea) {
  return settingsStore.petFrame(petIndex, screenArea);
}

export function resetPetFrameForScreen(
  settingsStore: SettingsStore,
  petIndex: number,
  screenArea: ScreenArea
): Rect {
  const frame = applyPetSizeScale(
    defaultPetFrame(petIndex, screenArea),
    settingsStore.petSizeScale(petIndex)
  );
  settingsStore.setPetFrame(frame, petIndex);
  return frame;
}

export function setPetSizeScaleForScreen(
  settingsStore: SettingsStore,
  petIndex: number,
  scale: number,
  screenArea: ScreenArea
): Rect {
  const previousFrame = settingsStore.petFrame(petIndex, screenArea);
  settingsStore.setPetSizeScale(scale, petIndex);
  const frame = applyPetSizeScale(previousFrame, settingsStore.petSizeScale(petIndex));
  settingsStore.setPetFrame(frame, petIndex);
  return frame;
}
