import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { downloadRemoteMaterial, importDesktopBundle } from "../src/main/desktop-bundle-importer.ts";
import { remoteMaterialDestinationPath } from "../src/shared/remote-material-cache.ts";
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

function makeBundleWithOptionalMaterial(): DesktopPetBundle {
  const bundle = makeDisplayableBundle();
  return {
    ...bundle,
    pets: [
      {
        ...bundle.pets[0],
        materials: [
          ...bundle.pets[0].materials,
          {
            slot: "click_react",
            name: "点击反应",
            videoUrl: "https://example.com/click.mp4",
            status: "ready"
          }
        ]
      }
    ]
  };
}

function makeBundleWithoutMaterials(): DesktopPetBundle {
  return {
    version: 1,
    generatedAt: "2026-06-24T00:00:00.000Z",
    pets: [
      {
        id: "pet_empty",
        petNumber: "CAT-EMPTY",
        name: "团子",
        type: "cat",
        ownership: "owned",
        displayState: "active",
        materials: []
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
    removeVideo: () => undefined,
    saveSyncedPetCards: (cards: DesktopSyncedPetCard[]) => {
      savedCards.push(cards);
    }
  };
  const petColonyController = {
    setPetCount: () => undefined,
    refreshDisplayNames: () => undefined,
    showAll: () => true,
    hideAll: () => undefined
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

test("keeps existing local material paths when remote download fails", async () => {
  const savedPaths = new Map([["0:idle_loop", "C:/local/old-idle.mp4"]]);
  const settingsStore = {
    petCount: 1,
    isPetVisible: false,
    setPetName: () => undefined,
    saveVideoPath: (videoPath: string, slot: string, petIndex: number) => {
      savedPaths.set(`${petIndex}:${slot}`, videoPath);
    },
    removeVideo: () => undefined,
    saveSyncedPetCards: () => undefined
  };
  const petColonyController = {
    setPetCount: () => undefined,
    refreshDisplayNames: () => undefined,
    showAll: () => true,
    hideAll: () => undefined
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

  assert.equal(savedPaths.get("0:idle_loop"), "C:/local/old-idle.mp4");
  assert.equal(settingsStore.isPetVisible, false);
});

test("imports the desktop pet when optional remote material downloads fail", async () => {
  const savedPaths = new Map<string, string>();
  const removedSlots: string[] = [];
  const settingsStore = {
    petCount: 1,
    isPetVisible: false,
    setPetName: () => undefined,
    saveVideoPath: (videoPath: string, slot: string, petIndex: number) => {
      savedPaths.set(`${petIndex}:${slot}`, videoPath);
    },
    removeVideo: (slot: string, petIndex: number) => {
      removedSlots.push(`${petIndex}:${slot}`);
    },
    saveSyncedPetCards: () => undefined
  };
  const petColonyController = {
    setPetCount: (count: number) => {
      settingsStore.petCount = count;
    },
    refreshDisplayNames: () => undefined,
    showAll: () => true,
    hideAll: () => undefined
  };

  const summary = await importDesktopBundle(makeBundleWithOptionalMaterial(), {
    settingsStore,
    petColonyController,
    remoteMaterialRoot: "/tmp/remote-materials",
    downloadRemoteMaterial: async (material) => {
      if (material.slot === "idle_loop") {
        return "C:/remote/idle.mp4";
      }

      throw new Error("optional download failed");
    }
  });

  assert.deepEqual(summary, { petCount: 1, materialCount: 1 });
  assert.equal(settingsStore.isPetVisible, true);
  assert.equal(savedPaths.get("0:idle_loop"), "C:/remote/idle.mp4");
  assert.equal(savedPaths.has("0:click_react"), false);
  assert.ok(removedSlots.includes("0:idle_loop"));
  assert.ok(removedSlots.includes("0:click_react"));
});

test("caches synced pet cards before empty material bundles fail", async () => {
  const savedCards: DesktopSyncedPetCard[][] = [];
  const settingsStore = {
    petCount: 1,
    isPetVisible: false,
    setPetName: () => undefined,
    saveVideoPath: () => undefined,
    removeVideo: () => undefined,
    saveSyncedPetCards: (cards: DesktopSyncedPetCard[]) => {
      savedCards.push(cards);
    }
  };
  const petColonyController = {
    setPetCount: () => undefined,
    refreshDisplayNames: () => undefined,
    showAll: () => true,
    hideAll: () => undefined
  };

  await assert.rejects(
    importDesktopBundle(makeBundleWithoutMaterials(), {
      settingsStore,
      petColonyController,
      remoteMaterialRoot: "/tmp/remote-materials"
    }),
    (error) => error instanceof Error && error.message === "网页端还没有可同步的视频素材。"
  );

  assert.deepEqual(
    savedCards.map((cards) => cards.map((card) => card.id)),
    [["pet_empty"]]
  );
});

test("hides old desktop pets when the refreshed bundle has no displayable pets", async () => {
  const hiddenCalls: number[] = [];
  const settingsStore = {
    petCount: 1,
    isPetVisible: true,
    setPetName: () => undefined,
    saveVideoPath: () => undefined,
    removeVideo: () => undefined,
    saveSyncedPetCards: () => undefined
  };
  const petColonyController = {
    setPetCount: (count: number) => {
      settingsStore.petCount = count;
    },
    refreshDisplayNames: () => undefined,
    showAll: () => false,
    hideAll: () => {
      hiddenCalls.push(1);
      settingsStore.isPetVisible = false;
    }
  };

  const summary = await importDesktopBundle(
    {
      version: 1,
      generatedAt: "2026-06-24T00:00:00.000Z",
      pets: [
        {
          id: "pet_orange",
          petNumber: "CAT-001",
          name: "栗子",
          type: "cat",
          ownership: "away",
          displayState: "unavailable",
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
    },
    {
      settingsStore,
      petColonyController,
      remoteMaterialRoot: "/tmp/remote-materials"
    }
  );

  assert.deepEqual(summary, { petCount: 0, materialCount: 0 });
  assert.equal(settingsStore.petCount, 0);
  assert.equal(settingsStore.isPetVisible, false);
  assert.equal(hiddenCalls.length, 1);
});

test("reuses cached remote material when URL metadata matches", async () => {
  const remoteMaterialRoot = await mkdtemp(path.join(tmpdir(), "cat-remote-materials-"));
  const material = makeDisplayableBundle().pets[0].materials[0];
  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, "pet_orange", material);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, "cached-video");
  await writeFile(`${destination}.url`, material.videoUrl);

  try {
    const videoPath = await downloadRemoteMaterial(material, "pet_orange", remoteMaterialRoot, {
      fetchImpl: async () => {
        throw new Error("expected cached material");
      }
    });

    assert.equal(videoPath, destination);
    assert.equal(await readFile(destination, "utf8"), "cached-video");
  } finally {
    await rm(remoteMaterialRoot, { recursive: true, force: true });
  }
});

test("rejects HTML error pages instead of caching them as remote materials", async () => {
  const remoteMaterialRoot = await mkdtemp(path.join(tmpdir(), "cat-remote-materials-"));
  const material = makeDisplayableBundle().pets[0].materials[0];
  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, "pet_orange", material);

  try {
    await assert.rejects(
      downloadRemoteMaterial(material, "pet_orange", remoteMaterialRoot, {
        fetchImpl: async () =>
          new Response("<!doctype html><title>not a video</title>", {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" }
          })
      }),
      (error) => error instanceof Error && error.message === "桌面同步返回异常。"
    );

    await assert.rejects(readFile(destination, "utf8"));
  } finally {
    await rm(remoteMaterialRoot, { recursive: true, force: true });
  }
});

test("rejects static images instead of caching them as remote materials", async () => {
  const remoteMaterialRoot = await mkdtemp(path.join(tmpdir(), "cat-remote-materials-"));
  const material = makeDisplayableBundle().pets[0].materials[0];
  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, "pet_orange", material);

  try {
    await assert.rejects(
      downloadRemoteMaterial(material, "pet_orange", remoteMaterialRoot, {
        fetchImpl: async () =>
          new Response("image-bytes", {
            status: 200,
            headers: { "content-type": "image/png" }
          })
      }),
      (error) => error instanceof Error && error.message === "桌面同步返回异常。"
    );

    await assert.rejects(readFile(destination, "utf8"));
  } finally {
    await rm(remoteMaterialRoot, { recursive: true, force: true });
  }
});

test("does not reuse cached remote material bytes that look like HTML", async () => {
  const remoteMaterialRoot = await mkdtemp(path.join(tmpdir(), "cat-remote-materials-"));
  const material = makeDisplayableBundle().pets[0].materials[0];
  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, "pet_orange", material);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, "<html>cached error page</html>");
  await writeFile(`${destination}.url`, material.videoUrl);

  try {
    const videoPath = await downloadRemoteMaterial(material, "pet_orange", remoteMaterialRoot, {
      fetchImpl: async () =>
        new Response("video-bytes", {
          status: 200,
          headers: { "content-type": "video/mp4" }
        })
    });

    assert.equal(videoPath, destination);
    assert.equal(await readFile(destination, "utf8"), "video-bytes");
  } finally {
    await rm(remoteMaterialRoot, { recursive: true, force: true });
  }
});

test("does not reuse cached remote material bytes that look like an image", async () => {
  const remoteMaterialRoot = await mkdtemp(path.join(tmpdir(), "cat-remote-materials-"));
  const material = makeDisplayableBundle().pets[0].materials[0];
  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, "pet_orange", material);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  await writeFile(`${destination}.url`, material.videoUrl);

  try {
    const videoPath = await downloadRemoteMaterial(material, "pet_orange", remoteMaterialRoot, {
      fetchImpl: async () =>
        new Response("video-bytes", {
          status: 200,
          headers: { "content-type": "video/mp4" }
        })
    });

    assert.equal(videoPath, destination);
    assert.equal(await readFile(destination, "utf8"), "video-bytes");
  } finally {
    await rm(remoteMaterialRoot, { recursive: true, force: true });
  }
});
