export type StartupPetVisibilityRestorePlan = {
  shouldShowPets: boolean;
  didRestoreVideo: boolean;
  nextIsPetVisible: boolean;
  shouldRefreshTray: boolean;
};

export function startupPetVisibilityRestorePlan(input: {
  wasPetVisible: boolean;
  didShowAnyPet: boolean;
}): StartupPetVisibilityRestorePlan {
  if (!input.wasPetVisible) {
    return {
      shouldShowPets: false,
      didRestoreVideo: false,
      nextIsPetVisible: false,
      shouldRefreshTray: false
    };
  }

  return {
    shouldShowPets: true,
    didRestoreVideo: input.didShowAnyPet,
    nextIsPetVisible: input.didShowAnyPet,
    shouldRefreshTray: true
  };
}
