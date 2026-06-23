import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultVideoGenerationSettings,
  normalizeVideoGenerationSettings
} from "./generation-settings.ts";

test("normalizes saved video generation settings with defaults", () => {
  const settings = normalizeVideoGenerationSettings({
    model: "doubao-seedance-2-0-mini-260615",
    resolution: "480p",
    generateAudio: true
  });

  assert.equal(settings.model, "doubao-seedance-2-0-mini-260615");
  assert.equal(settings.resolution, "480p");
  assert.equal(settings.generateAudio, true);
  assert.equal(settings.ratio, defaultVideoGenerationSettings.ratio);
  assert.equal(settings.framesPerSecond, defaultVideoGenerationSettings.framesPerSecond);
});

test("defaults to the Doubao Seedance 2.0 fast model when saved settings omit model", () => {
  const settings = normalizeVideoGenerationSettings({
    resolution: "480p"
  });

  assert.equal(defaultVideoGenerationSettings.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(settings.model, "doubao-seedance-2-0-fast-260128");
});

test("keeps the Doubao Seedance 2.0 fast model when saved settings select it", () => {
  const settings = normalizeVideoGenerationSettings({
    model: "doubao-seedance-2-0-fast-260128",
    resolution: "480p"
  });

  assert.equal(settings.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(settings.resolution, "480p");
});

test("falls back to the Doubao Seedance 2.0 fast model for obsolete settings", () => {
  const settings = normalizeVideoGenerationSettings({
    model: "doubao-seed-2-0-mini-260428",
    resolution: "480p"
  });

  assert.equal(settings.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(settings.resolution, "480p");
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
