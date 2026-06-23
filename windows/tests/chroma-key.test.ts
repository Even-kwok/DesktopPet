import assert from "node:assert/strict";
import test from "node:test";
import { chromaKeyPixel } from "../src/renderer/pet/chroma-key.ts";

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
