import assert from "node:assert/strict";
import test from "node:test";
import {
  nextSelectedPetIndexAfterAction,
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
