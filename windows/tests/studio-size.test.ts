import assert from "node:assert/strict";
import test from "node:test";
import {
  isSelectedStudioPetSize,
  studioPetSizeOptions
} from "../src/renderer/studio/studio-size.ts";

test("builds Mac-parity studio pet size labels", () => {
  assert.deepEqual(
    studioPetSizeOptions().map((option) => option.label),
    ["最大 100%", "90%", "80%", "70%", "60%", "50%", "40%", "30%"]
  );
});

test("marks the current studio pet size with tolerance", () => {
  assert.equal(isSelectedStudioPetSize(0.8, 0.8004), true);
  assert.equal(isSelectedStudioPetSize(0.8, 0.7), false);
});
