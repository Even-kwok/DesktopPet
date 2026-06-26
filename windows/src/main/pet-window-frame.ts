import { applyPetSizeScale, defaultPetFrame } from "../shared/settings-store.ts";
import type { Rect, ScreenArea, SettingsStore } from "../shared/settings-store.ts";

export function petFrameForScreen(settingsStore: SettingsStore, petIndex: number, screenArea: ScreenArea) {
  const frame = settingsStore.petFrame(petIndex, screenArea);
  const normalizedFrame = applyPetSizeScale(frame, settingsStore.petSizeScale(petIndex));
  if (!rectsEqual(frame, normalizedFrame)) {
    settingsStore.setPetFrame(normalizedFrame, petIndex);
  }
  return normalizedFrame;
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
  const previousFrame = petFrameForScreen(settingsStore, petIndex, screenArea);
  settingsStore.setPetSizeScale(scale, petIndex);
  const frame = applyPetSizeScale(previousFrame, settingsStore.petSizeScale(petIndex));
  settingsStore.setPetFrame(frame, petIndex);
  return frame;
}

export function movePetFrameBy(frame: Rect, delta: { x: number; y: number }): Rect {
  return {
    ...frame,
    x: frame.x + Math.round(delta.x),
    y: frame.y + Math.round(delta.y)
  };
}

export function movedPetFrameFromWindowBounds(previousFrame: Rect, bounds: Rect): Rect {
  return {
    ...previousFrame,
    x: bounds.x,
    y: bounds.y
  };
}

function rectsEqual(first: Rect, second: Rect) {
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
}
