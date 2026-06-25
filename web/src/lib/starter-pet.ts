import type { Pet } from "./types.ts";

export const starterPetAssetBundleUrl = "desktop-pet:starter-cat-v1";

export type StarterPetAssetSeed = {
  slot: string;
  videoUrl: string;
};

const legacyDefaultStarterPetAssetUrls: Record<string, string> = {
  idle_loop:
    "https://github.com/Even-kwok/DesktopPet/releases/download/starter-assets/starter-cat-idle_loop-v2.mp4",
  sleep_loop:
    "https://github.com/Even-kwok/DesktopPet/releases/download/starter-assets/starter-cat-sleep_loop-v2.mp4",
  catch_bug:
    "https://github.com/Even-kwok/DesktopPet/releases/download/starter-assets/starter-cat-catch_bug-v2.mp4",
  click_react:
    "https://github.com/Even-kwok/DesktopPet/releases/download/starter-assets/starter-cat-click_react-v2.mp4"
};

export function isLegacyDefaultStarterPetAssetUrl(videoUrl: string) {
  const normalized = videoUrl.trim();
  return Object.values(legacyDefaultStarterPetAssetUrls).some((legacyUrl) => legacyUrl === normalized);
}

export function isReadonlyPet(pet: Pick<Pet, "isReadonly">) {
  return pet.isReadonly === true;
}

export function sortPetsForAccount<T extends Pick<Pet, "isReadonly" | "petNumber">>(pets: T[]) {
  return [...pets].sort((left, right) => {
    if (isReadonlyPet(left) !== isReadonlyPet(right)) {
      return isReadonlyPet(left) ? 1 : -1;
    }

    return left.petNumber.localeCompare(right.petNumber);
  });
}
