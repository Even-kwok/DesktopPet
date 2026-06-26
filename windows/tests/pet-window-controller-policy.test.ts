import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const petWindowControllerSource = readFileSync(
  new URL("../src/main/pet-window-controller.ts", import.meta.url),
  "utf8"
);

test("does not persist resize events from non-resizable pet windows", () => {
  assert.doesNotMatch(petWindowControllerSource, /window\.on\("resized"/);
});

test("dragging reapplies the full canonical pet bounds", () => {
  assert.doesNotMatch(petWindowControllerSource, /\.setPosition\(/);
  assert.match(petWindowControllerSource, /this\.#window\.setBounds\(this\.#rectToBounds\(frame\)\)/);
});

test("locks pet window min and max size to the active frame", () => {
  assert.match(petWindowControllerSource, /\.setMinimumSize\(/);
  assert.match(petWindowControllerSource, /\.setMaximumSize\(/);
});
