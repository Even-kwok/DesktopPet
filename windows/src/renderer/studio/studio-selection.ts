export type StudioSelectionState = {
  petCount: number;
  petNames: string[];
};

export function nextSelectedPetIndexAfterAction(
  currentPetIndex: number,
  state: StudioSelectionState,
  actionResult: unknown
) {
  const resultPetIndex = petIndexFromActionResult(actionResult);
  return clampPetIndex(resultPetIndex ?? currentPetIndex, state.petCount);
}

export function petNameDraftForIndex(state: StudioSelectionState, petIndex: number) {
  return state.petNames[petIndex] ?? `Pet ${petIndex + 1}`;
}

function petIndexFromActionResult(actionResult: unknown) {
  if (!actionResult || typeof actionResult !== "object") {
    return undefined;
  }

  const candidate = (actionResult as { petIndex?: unknown }).petIndex;
  return Number.isInteger(candidate) ? (candidate as number) : undefined;
}

function clampPetIndex(petIndex: number, petCount: number) {
  const lastPetIndex = Math.max(petCount - 1, 0);
  return Math.min(Math.max(petIndex, 0), lastPetIndex);
}
