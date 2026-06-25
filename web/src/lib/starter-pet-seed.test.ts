import test from "node:test";
import assert from "node:assert/strict";
import {
  getStarterPetSeed,
  starterPetSeedFromTemplate
} from "./starter-pet-seed.ts";
import { isLegacyDefaultStarterPetAssetUrl } from "./starter-pet.ts";

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

test("starter seed does not fall back to legacy release asset URLs", () => {
  withStarterEnv({}, () => {
    const seed = getStarterPetSeed();

    assert.equal(seed.name, "体验猫");
    assert.deepEqual(seed.assets, []);
  });
});

test("starter seed reads explicitly configured material URLs", () => {
  withStarterEnv(
    {
      STARTER_CAT_IDLE_LOOP_VIDEO_URL: "https://example.com/idle.mp4",
      STARTER_CAT_ASSET_URLS_JSON: JSON.stringify({
        sleep_loop: "https://example.com/sleep.mp4"
      })
    },
    () => {
      const seed = getStarterPetSeed();

      assert.deepEqual(seed.assets, [
        { slot: "idle_loop", videoUrl: "https://example.com/idle.mp4" },
        { slot: "sleep_loop", videoUrl: "https://example.com/sleep.mp4" }
      ]);
      assert.equal(
        isLegacyDefaultStarterPetAssetUrl(
          "https://github.com/Even-kwok/DesktopPet/releases/download/starter-assets/starter-cat-idle_loop-v2.mp4"
        ),
        true
      );
    }
  );
});

function withStarterEnv(values: Record<string, string>, run: () => void) {
  const names = [
    "STARTER_CAT_NAME",
    "STARTER_CAT_IMAGE_URL",
    "NEXT_PUBLIC_STARTER_CAT_IMAGE_URL",
    "STARTER_CAT_IDLE_LOOP_VIDEO_URL",
    "STARTER_CAT_SLEEP_LOOP_VIDEO_URL",
    "STARTER_CAT_CATCH_BUG_VIDEO_URL",
    "STARTER_CAT_CLICK_REACT_VIDEO_URL",
    "STARTER_CAT_ASSET_URLS_JSON"
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));

  for (const name of names) {
    delete process.env[name];
  }
  for (const [name, value] of Object.entries(values)) {
    process.env[name] = value;
  }

  try {
    run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}
