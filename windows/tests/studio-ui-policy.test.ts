import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const studioAppSource = readFileSync(
  fileURLToPath(new URL("../src/renderer/studio/StudioApp.tsx", import.meta.url)),
  "utf8"
);

test("starts Windows Studio login fields empty instead of prefilled with demo credentials", () => {
  assert.doesNotMatch(studioAppSource, /useState\("demo@desktop\.pet"\)/);
  assert.doesNotMatch(studioAppSource, /useState\("123456"\)/);
  assert.doesNotMatch(studioAppSource, /demo@desktop\.pet/);
});

test("keeps local material management out of the Windows Studio surface", () => {
  assert.doesNotMatch(studioAppSource, /动作卡册/);
  assert.doesNotMatch(studioAppSource, /localMaterialBoard/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.importVideo/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.removeVideo/);
});

test("shows login feedback near the top of the Windows Studio window", () => {
  const statusIndex = studioAppSource.indexOf('className="status-line" role="status"');
  const gridIndex = studioAppSource.indexOf('className="studio-grid"');

  assert.notEqual(statusIndex, -1);
  assert.notEqual(gridIndex, -1);
  assert.ok(statusIndex < gridIndex);
  assert.doesNotMatch(studioAppSource, /bridge\?\.signIn\?\./);
});
