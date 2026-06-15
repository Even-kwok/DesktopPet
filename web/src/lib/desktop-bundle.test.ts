import test from "node:test";
import assert from "node:assert/strict";
import { buildDesktopPetBundle } from "./desktop-bundle.ts";

test("desktop bundle exports only ready materials with video URLs", () => {
  const bundle = buildDesktopPetBundle({
    generatedAt: "2026-06-16T08:00:00.000Z",
    pets: [
      {
        id: "pet_orange",
        name: "栗子",
        type: "cat",
        status: "在我的桌面",
        materialsReady: 0,
        mood: "好奇",
        host: "me",
        sourceImageUrl: "https://example.com/source.png",
        frontImageUrl: "https://example.com/front.png"
      }
    ],
    assets: [
      {
        petId: "pet_orange",
        slot: "idle_loop",
        status: "ready",
        videoUrl: "https://example.com/idle.mp4"
      },
      {
        petId: "pet_orange",
        slot: "sleep_loop",
        status: "ready",
        videoUrl: null
      },
      {
        petId: "pet_orange",
        slot: "click_react",
        status: "generating",
        videoUrl: "https://example.com/click.mp4"
      }
    ]
  });

  assert.equal(bundle.generatedAt, "2026-06-16T08:00:00.000Z");
  assert.equal(bundle.pets.length, 1);
  assert.equal(bundle.pets[0].name, "栗子");
  assert.equal(bundle.pets[0].avatarUrl, "https://example.com/front.png");
  assert.deepEqual(
    bundle.pets[0].materials.map((material) => material.slot),
    ["idle_loop"]
  );
});
