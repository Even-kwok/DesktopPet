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

export function nextSelectedPetIndexAfterStudioCommand(
  currentPetIndex: number,
  state: StudioSelectionState,
  command: unknown
) {
  const requestedPetIndex = petIndexFromStudioCommand(command);
  return clampPetIndex(requestedPetIndex ?? currentPetIndex, state.petCount);
}

export function petNameDraftForIndex(state: StudioSelectionState, petIndex: number) {
  return state.petNames[petIndex] ?? `Pet ${petIndex + 1}`;
}

export function nextSelectedSyncedPetID(
  currentPetID: string | undefined,
  refreshedPetID: string | undefined,
  syncedPetCards: readonly { id: string }[]
) {
  if (isSyncedPetIDInCards(currentPetID, syncedPetCards)) {
    return currentPetID;
  }

  if (isSyncedPetIDInCards(refreshedPetID, syncedPetCards)) {
    return refreshedPetID;
  }

  return syncedPetCards[0]?.id;
}

function petIndexFromActionResult(actionResult: unknown) {
  if (!actionResult || typeof actionResult !== "object") {
    return undefined;
  }

  const candidate = (actionResult as { petIndex?: unknown }).petIndex;
  return Number.isInteger(candidate) ? (candidate as number) : undefined;
}

function petIndexFromStudioCommand(command: unknown) {
  if (!command || typeof command !== "object") {
    return undefined;
  }

  const record = command as { type?: unknown; petIndex?: unknown };
  return record.type === "selectPet" && Number.isInteger(record.petIndex)
    ? (record.petIndex as number)
    : undefined;
}

function isSyncedPetIDInCards(petID: string | undefined, syncedPetCards: readonly { id: string }[]) {
  return petID !== undefined && syncedPetCards.some((pet) => pet.id === petID);
}

function clampPetIndex(petIndex: number, petCount: number) {
  const lastPetIndex = Math.max(petCount - 1, 0);
  return Math.min(Math.max(petIndex, 0), lastPetIndex);
}
