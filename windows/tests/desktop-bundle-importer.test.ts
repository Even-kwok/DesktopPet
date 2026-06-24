import assert from "node:assert/strict";
import test from "node:test";
import { importDesktopBundle } from "../src/main/desktop-bundle-importer.ts";
import type { DesktopPetBundle } from "../src/shared/desktop-sync-client.ts";
import type { DesktopSyncedPetCard } from "../src/shared/settings-store.ts";

function makeDisplayableBundle(): DesktopPetBundle {
  return {
    version: 1,
    generatedAt: "2026-06-24T00:00:00.000Z",
    pets: [
      {
        id: "pet_orange",
        petNumber: "CAT-001",
        name: "栗子",
        type: "cat",
        ownership: "owned",
        displayState: "active",
        materials: [
          {
            slot: "idle_loop",
            name: "待机循环",
            videoUrl: "https://example.com/idle.mp4",
            status: "ready"
          }
        ]
      }
    ]
  };
}

test("caches synced pet cards before remote material downloads can fail", async () => {
  const savedCards: DesktopSyncedPetCard[][] = [];
  const settingsStore = {
    petCount: 1,
    isPetVisible: false,
    setPetName: () => undefined,
    saveVideoPath: () => undefined,
    saveSyncedPetCards: (cards: DesktopSyncedPetCard[]) => {
      savedCards.push(cards);
    }
  };
  const petColonyController = {
    setPetCount: () => undefined,
    refreshDisplayNames: () => undefined,
    showAll: () => true
  };

  await assert.rejects(
    importDesktopBundle(makeDisplayableBundle(), {
      settingsStore,
      petColonyController,
      remoteMaterialRoot: "/tmp/remote-materials",
      downloadRemoteMaterial: async () => {
        throw new Error("download failed");
      }
    }),
    /download failed/
  );

  assert.deepEqual(
    savedCards.map((cards) => cards.map((card) => card.id)),
    [["pet_orange"]]
  );
});
