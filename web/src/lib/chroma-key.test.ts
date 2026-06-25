import assert from "node:assert/strict";
import test from "node:test";

import {
  chromaKeyPixel,
  hasVisibleChromaKeyContent,
  processChromaKeyFrame
} from "./chroma-key.ts";

test("web preview chroma key makes strong green transparent", () => {
  const pixel = chromaKeyPixel({ red: 0.05, green: 0.95, blue: 0.08, alpha: 1 });

  assert.ok(pixel.alpha < 0.1);
  assert.ok(pixel.green < 0.95);
});

test("web preview chroma key keeps orange fur opaque", () => {
  const pixel = chromaKeyPixel({ red: 0.86, green: 0.56, blue: 0.24, alpha: 1 });

  assert.equal(pixel.alpha, 1);
  assert.equal(pixel.red, 0.86);
});

test("web preview frame processor leaves visible pet pixels after keying green", () => {
  const frame = testImageData(
    [
      0, 255, 0, 255,
      220, 150, 80, 255
    ],
    2,
    1
  );

  assert.equal(hasVisibleChromaKeyContent(processChromaKeyFrame(frame)), true);
  assert.equal(frame.data[3] < 12, true);
  assert.equal(frame.data[7], 255);
});

function testImageData(data: number[], width: number, height: number) {
  return {
    data: new Uint8ClampedArray(data),
    width,
    height,
    colorSpace: "srgb"
  } as ImageData;
}
