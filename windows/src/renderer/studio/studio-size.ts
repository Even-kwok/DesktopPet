import { petSizeScaleOptions } from "../../shared/pet-action-slots.ts";

export function studioPetSizeOptions() {
  return petSizeScaleOptions.map((scale) => ({
    scale,
    label: scale === 1 ? "最大 100%" : `${Math.round(scale * 100)}%`
  }));
}

export function isSelectedStudioPetSize(optionScale: number, currentScale: number) {
  return Math.abs(optionScale - currentScale) < 0.001;
}
