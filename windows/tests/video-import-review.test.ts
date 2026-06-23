import assert from "node:assert/strict";
import test from "node:test";
import { reviewPetVideoImport } from "../src/shared/video-import-review.ts";

test("accepts normal short clips", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 12 * 1024 * 1024,
    durationSeconds: 8,
    hasVideoTrack: true
  });

  assert.equal(review.canImport, true);
  assert.deepEqual(review.blockingMessages, []);
  assert.deepEqual(review.warningMessages, []);
});

test("blocks files without video tracks", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 3 * 1024 * 1024,
    durationSeconds: 8,
    hasVideoTrack: false
  });

  assert.equal(review.canImport, false);
  assert.match(review.blockingMessages.join(" "), /视频画面/);
});

test("blocks long and oversized files", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 400 * 1024 * 1024,
    durationSeconds: 70,
    hasVideoTrack: true
  });

  assert.equal(review.canImport, false);
  assert.match(review.blockingMessages.join(" "), /60 秒以内/);
  assert.match(review.blockingMessages.join(" "), /300MB/);
});

test("warns for long or large clips that can still import", () => {
  const review = reviewPetVideoImport({
    fileSizeBytes: 120 * 1024 * 1024,
    durationSeconds: 22,
    hasVideoTrack: true
  });

  assert.equal(review.canImport, true);
  assert.match(review.warningMessages.join(" "), /有点长/);
  assert.match(review.warningMessages.join(" "), /有点大/);
});
