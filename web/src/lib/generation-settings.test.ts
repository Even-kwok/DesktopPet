import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultVideoGenerationSettings,
  normalizeVideoGenerationSettings
} from "./generation-settings.ts";

test("normalizes saved video generation settings with defaults", () => {
  const settings = normalizeVideoGenerationSettings({
    model: "doubao-seedance-2-0-fast-260128",
    resolution: "480p",
    generateAudio: true
  });

  assert.equal(settings.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(settings.resolution, "480p");
  assert.equal(settings.generateAudio, true);
  assert.equal(settings.ratio, defaultVideoGenerationSettings.ratio);
  assert.equal(settings.framesPerSecond, defaultVideoGenerationSettings.framesPerSecond);
});

test("defaults to the API-capable Seedance fast model when saved settings omit model", () => {
  const settings = normalizeVideoGenerationSettings({
    resolution: "480p"
  });

  assert.equal(defaultVideoGenerationSettings.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(settings.model, "doubao-seedance-2-0-fast-260128");
});

test("falls back when saved video generation settings contain unsupported values", () => {
  const settings = normalizeVideoGenerationSettings({
    model: "unknown-model",
    resolution: "1080p",
    framesPerSecond: 30,
    watermark: "yes"
  });

  assert.equal(settings.model, defaultVideoGenerationSettings.model);
  assert.equal(settings.resolution, defaultVideoGenerationSettings.resolution);
  assert.equal(settings.framesPerSecond, defaultVideoGenerationSettings.framesPerSecond);
  assert.equal(settings.watermark, defaultVideoGenerationSettings.watermark);
});
