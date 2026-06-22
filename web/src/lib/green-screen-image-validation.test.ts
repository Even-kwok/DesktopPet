import test from "node:test";
import assert from "node:assert/strict";

import { reviewGreenScreenImage } from "./green-screen-image-validation.ts";

test("green screen image review accepts a clear green still image", () => {
  const review = reviewGreenScreenImage({
    contentType: "image/png",
    sizeBytes: 2 * 1024 * 1024,
    width: 1200,
    height: 1200,
    greenEdgeRatio: 0.82
  });

  assert.equal(review.canUse, true);
  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.warnings, []);
});

test("green screen image review blocks unsupported or tiny images", () => {
  const review = reviewGreenScreenImage({
    contentType: "image/gif",
    sizeBytes: 400 * 1024,
    width: 360,
    height: 360,
    greenEdgeRatio: 0.8
  });

  assert.equal(review.canUse, false);
  assert.match(review.errors.join(" "), /PNG、JPG 或 WebP/);
  assert.match(review.errors.join(" "), /至少 512/);
});

test("green screen image review warns when the background may not be green", () => {
  const review = reviewGreenScreenImage({
    contentType: "image/jpeg",
    sizeBytes: 2 * 1024 * 1024,
    width: 1080,
    height: 1080,
    greenEdgeRatio: 0.28
  });

  assert.equal(review.canUse, true);
  assert.match(review.warnings.join(" "), /绿幕/);
});
