import assert from "node:assert/strict";
import test from "node:test";
import {
  nextSelectedPetIndexAfterAction,
  nextSelectedPetIndexAfterStudioCommand,
  nextSelectedPetIndexAfterStudioRefresh,
  nextSelectedSyncedPetID,
  petNameDraftForIndex
} from "../src/renderer/studio/studio-selection.ts";

test("keeps current studio pet selection within the refreshed pet count", () => {
  assert.equal(
    nextSelectedPetIndexAfterAction(3, { petCount: 2, petNames: ["Milo", "Luna"] }, undefined),
    1
  );
});

test("selects the pet returned by a studio add action", () => {
  assert.equal(
    nextSelectedPetIndexAfterAction(
      0,
      { petCount: 3, petNames: ["Milo", "Luna", "Nico"] },
      { petIndex: 2 }
    ),
    2
  );
});

test("uses the refreshed pet name for the selected pet draft", () => {
  assert.equal(petNameDraftForIndex({ petCount: 2, petNames: ["Milo", "Luna"] }, 1), "Luna");
  assert.equal(petNameDraftForIndex({ petCount: 2, petNames: [] }, 1), "Pet 2");
});

test("selects the tray-requested pet from a Studio command", () => {
  const state = { petCount: 2, petNames: ["Milo", "Luna"] };

  assert.equal(nextSelectedPetIndexAfterStudioCommand(0, state, { type: "selectPet", petIndex: 1 }), 1);
  assert.equal(nextSelectedPetIndexAfterStudioCommand(0, state, { type: "selectPet", petIndex: 7 }), 1);
  assert.equal(nextSelectedPetIndexAfterStudioCommand(1, state, { type: "unknown", petIndex: 0 }), 1);
});

test("applies Studio commands against refreshed pet state", () => {
  const refreshedState = { petCount: 3, petNames: ["Milo", "Luna", "Nico"] };

  assert.equal(
    nextSelectedPetIndexAfterStudioRefresh(
      0,
      refreshedState,
      undefined,
      { type: "selectPet", petIndex: 2 }
    ),
    2
  );

  assert.equal(
    nextSelectedPetIndexAfterStudioRefresh(
      7,
      { petCount: 2, petNames: ["Milo", "Luna"] },
      undefined,
      { type: "refresh" }
    ),
    1
  );
});

test("keeps synced pet selection on a valid refreshed card", () => {
  const cards = [{ id: "pet-a" }, { id: "pet-b" }];

  assert.equal(nextSelectedSyncedPetID("pet-b", "pet-a", cards), "pet-b");
  assert.equal(nextSelectedSyncedPetID("missing-pet", "pet-a", cards), "pet-a");
  assert.equal(nextSelectedSyncedPetID("missing-pet", "also-missing", cards), "pet-a");
  assert.equal(nextSelectedSyncedPetID("missing-pet", undefined, []), undefined);
});
