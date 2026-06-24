export type PetWindowPlaybackRefreshPlan = {
  shouldReplayCurrentState: boolean;
};

export function planPetWindowPlaybackRefresh(input: { isVisible: boolean }): PetWindowPlaybackRefreshPlan {
  return {
    shouldReplayCurrentState: input.isVisible
  };
}
