export type StartupPetVisibilityRestorePlan = {
  shouldApplyClickThrough: boolean;
  clickThrough: boolean;
  shouldShowPets: boolean;
  didRestoreVideo: boolean;
  nextIsPetVisible: boolean;
  shouldRefreshTray: boolean;
};

export function startupPetVisibilityRestorePlan(input: {
  wasPetVisible: boolean;
  didShowAnyPet: boolean;
  isClickThrough: boolean;
}): StartupPetVisibilityRestorePlan {
  if (!input.wasPetVisible) {
    return {
      shouldApplyClickThrough: true,
      clickThrough: input.isClickThrough,
      shouldShowPets: false,
      didRestoreVideo: false,
      nextIsPetVisible: false,
      shouldRefreshTray: false
    };
  }

  return {
    shouldApplyClickThrough: true,
    clickThrough: input.isClickThrough,
    shouldShowPets: true,
    didRestoreVideo: input.didShowAnyPet,
    nextIsPetVisible: input.didShowAnyPet,
    shouldRefreshTray: true
  };
}
