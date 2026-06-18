import test from "node:test";
import assert from "node:assert/strict";

import { materialCostLabel } from "./admin-material-table.ts";

test("material table shows compact per-run cost", () => {
  assert.equal(
    materialCostLabel({ durationSeconds: 7, creditsPerSecond: 2, costCredits: 14 }),
    "14 分/次"
  );
});
