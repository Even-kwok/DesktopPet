import { applyPetSizeScale, defaultPetFrame } from "../shared/settings-store.ts";
import type { Rect, SettingsStore } from "../shared/settings-store.ts";

export type ScreenSize = {
  width: number;
  height: number;
};

export function petFrameForScreen(settingsStore: SettingsStore, petIndex: number, screenSize: ScreenSize) {
  return settingsStore.petFrame(petIndex, screenSize);
}

export function resetPetFrameForScreen(
  settingsStore: SettingsStore,
  petIndex: number,
  screenSize: ScreenSize
): Rect {
  const frame = applyPetSizeScale(
    defaultPetFrame(petIndex, screenSize),
    settingsStore.petSizeScale(petIndex)
  );
  settingsStore.setPetFrame(frame, petIndex);
  return frame;
}

export function setPetSizeScaleForScreen(
  settingsStore: SettingsStore,
  petIndex: number,
  scale: number,
  screenSize: ScreenSize
): Rect {
  const previousFrame = settingsStore.petFrame(petIndex, screenSize);
  settingsStore.setPetSizeScale(scale, petIndex);
  const frame = applyPetSizeScale(previousFrame, settingsStore.petSizeScale(petIndex));
  settingsStore.setPetFrame(frame, petIndex);
  return frame;
}
