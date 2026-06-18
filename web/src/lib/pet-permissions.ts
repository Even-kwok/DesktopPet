import type { CurrentUser, Pet } from "./types";

export function canDeletePetForAccount(account: CurrentUser, pet: Pet) {
  return pet.ownerUserId === account.id;
}
