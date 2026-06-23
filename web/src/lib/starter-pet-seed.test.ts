import test from "node:test";
import assert from "node:assert/strict";
import { starterPetSeedFromTemplate } from "./starter-pet-seed.ts";

test("starterPetSeedFromTemplate keeps starter name and copies template materials", () => {
  const seed = starterPetSeedFromTemplate(
    {
      name: "模板猫",
      imageUrl: "https://example.com/template.png",
      assets: [
        { slot: "idle_loop", videoUrl: "https://example.com/idle.mp4" },
        { slot: "sleep_loop", videoUrl: "https://example.com/sleep.mp4" }
      ]
    },
    {
      name: "体验猫",
      imageUrl: null,
      assets: [{ slot: "click_react", videoUrl: "https://example.com/click.mp4" }],
      assetBundleUrl: "desktop-pet:starter-cat-v1"
    }
  );

  assert.equal(seed.name, "体验猫");
  assert.equal(seed.imageUrl, "https://example.com/template.png");
  assert.deepEqual(seed.assets, [
    { slot: "idle_loop", videoUrl: "https://example.com/idle.mp4" },
    { slot: "sleep_loop", videoUrl: "https://example.com/sleep.mp4" }
  ]);
  assert.equal(seed.assetBundleUrl, "desktop-pet:starter-cat-v1");
});
