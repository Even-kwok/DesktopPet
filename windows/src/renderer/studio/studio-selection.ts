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

export function nextSelectedPetIndexAfterStudioRefresh(
  currentPetIndex: number,
  state: StudioSelectionState,
  actionResult: unknown,
  command: unknown
) {
  const actionPetIndex = nextSelectedPetIndexAfterAction(currentPetIndex, state, actionResult);
  return nextSelectedPetIndexAfterStudioCommand(actionPetIndex, state, command);
}

export function petNameDraftForIndex(state: StudioSelectionState, petIndex: number) {
  const normalizedPetIndex = clampPetIndex(petIndex, state.petCount);
  return state.petNames[normalizedPetIndex] ?? `Pet ${normalizedPetIndex + 1}`;
}

export function studioPetCountForDisplay(petCount: number) {
  return normalizedPetCount(petCount);
}

export function studioPetIndexesForDisplay(petCount: number) {
  return Array.from({ length: Math.max(studioPetCountForDisplay(petCount), 1) }, (_, index) => index);
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
  const petCountForClamp = normalizedPetCount(petCount);
  const normalizedPetIndex = Number.isInteger(petIndex) && petIndex >= 0 ? petIndex : 0;
  const lastPetIndex = Math.max(petCountForClamp - 1, 0);
  return Math.min(normalizedPetIndex, lastPetIndex);
}

function normalizedPetCount(petCount: unknown) {
  return typeof petCount === "number" && Number.isFinite(petCount)
    ? Math.max(Math.trunc(petCount), 0)
    : 0;
}
