import assert from "node:assert/strict";
import test from "node:test";
import {
  chromaKeyPixel,
  hasVisibleChromaKeyContent,
  processChromaKeyFrame
} from "../src/renderer/pet/chroma-key.ts";

test("keys out strongly green pixels", () => {
  const pixel = chromaKeyPixel({ red: 0.1, green: 0.95, blue: 0.1, alpha: 1 });

  assert.ok(pixel.alpha < 0.1);
  assert.ok(pixel.green < 0.95);
});

test("keeps non-green pixels opaque", () => {
  const pixel = chromaKeyPixel({ red: 0.8, green: 0.4, blue: 0.2, alpha: 1 });

  assert.equal(pixel.alpha, 1);
  assert.equal(pixel.red, 0.8);
});

test("detects when a keyed frame has no visible pet content", () => {
  const frame = testImageData(
    [
      0, 255, 0, 255,
      4, 250, 4, 255
    ],
    2,
    1
  );

  assert.equal(hasVisibleChromaKeyContent(processChromaKeyFrame(frame)), false);
});

test("detects visible pet pixels after green screen keying", () => {
  const frame = testImageData(
    [
      220, 180, 120, 255,
      0, 255, 0, 255
    ],
    2,
    1
  );

  assert.equal(hasVisibleChromaKeyContent(processChromaKeyFrame(frame)), true);
});

function testImageData(data: number[], width: number, height: number) {
  return {
    data: new Uint8ClampedArray(data),
    width,
    height,
    colorSpace: "srgb"
  } as ImageData;
}
