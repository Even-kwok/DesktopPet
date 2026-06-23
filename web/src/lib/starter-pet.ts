import type { Pet } from "./types.ts";

export const starterPetAssetBundleUrl = "desktop-pet:starter-cat-v1";

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
