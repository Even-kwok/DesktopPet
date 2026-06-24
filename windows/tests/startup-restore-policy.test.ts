import assert from "node:assert/strict";
import test from "node:test";
import { startupPetVisibilityRestorePlan } from "../src/main/startup-restore-policy.ts";

test("does not show pets when the previous session was hidden", () => {
  assert.deepEqual(
    startupPetVisibilityRestorePlan({
      wasPetVisible: false,
      didShowAnyPet: false
    }),
    {
      shouldShowPets: false,
      didRestoreVideo: false,
      nextIsPetVisible: false,
      shouldRefreshTray: false
    }
  );
});

test("keeps pets visible when restart restores at least one idle loop", () => {
  assert.deepEqual(
    startupPetVisibilityRestorePlan({
      wasPetVisible: true,
      didShowAnyPet: true
    }),
    {
      shouldShowPets: true,
      didRestoreVideo: true,
      nextIsPetVisible: true,
      shouldRefreshTray: true
    }
  );
});

test("turns off saved visibility when restart cannot restore any idle loop", () => {
  assert.deepEqual(
    startupPetVisibilityRestorePlan({
      wasPetVisible: true,
      didShowAnyPet: false
    }),
    {
      shouldShowPets: true,
      didRestoreVideo: false,
      nextIsPetVisible: false,
      shouldRefreshTray: true
    }
  );
});
