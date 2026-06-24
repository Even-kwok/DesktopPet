export type PetWindowWakeResumePlan = {
  shouldShowWindow: boolean;
  shouldReplayCurrentState: boolean;
};

export function planPetWindowWakeResume(input: { isVisible: boolean }): PetWindowWakeResumePlan {
  if (!input.isVisible) {
    return {
      shouldShowWindow: false,
      shouldReplayCurrentState: false
    };
  }

  return {
    shouldShowWindow: true,
    shouldReplayCurrentState: true
  };
}
