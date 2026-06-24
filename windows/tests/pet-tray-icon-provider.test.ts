import assert from "node:assert/strict";
import test from "node:test";
import { PetTrayIconProvider } from "../src/main/pet-tray-icon-provider.ts";

test("generates and caches pet tray thumbnails from idle-loop video paths", async () => {
  const createdPaths: string[] = [];
  const provider = new PetTrayIconProvider({
    createThumbnailFromPath: async (videoPath, size) => {
      createdPaths.push(`${videoPath}:${size.width}x${size.height}`);
      return { id: `thumb:${videoPath}`, isEmpty: () => false };
    }
  });
  let readyCount = 0;

  assert.equal(provider.iconForVideo("C:/cats/idle.mp4", () => readyCount += 1), undefined);
  assert.equal(provider.iconForVideo("C:/cats/idle.mp4", () => readyCount += 1), undefined);

  await Promise.resolve();

  assert.deepEqual(createdPaths, ["C:/cats/idle.mp4:28x28"]);
  assert.equal(readyCount, 1);
  assert.equal(
    (provider.iconForVideo("C:/cats/idle.mp4") as { id?: string } | undefined)?.id,
    "thumb:C:/cats/idle.mp4"
  );
});

test("ignores missing, empty, and failed pet tray thumbnail requests", async () => {
  const provider = new PetTrayIconProvider({
    createThumbnailFromPath: async (videoPath) => {
      if (videoPath.endsWith("empty.mp4")) {
        return { isEmpty: () => true };
      }

      throw new Error("thumbnail failed");
    }
  });
  let readyCount = 0;

  assert.equal(provider.iconForVideo(undefined, () => readyCount += 1), undefined);
  assert.equal(provider.iconForVideo("C:/cats/empty.mp4", () => readyCount += 1), undefined);
  assert.equal(provider.iconForVideo("C:/cats/broken.mp4", () => readyCount += 1), undefined);

  await Promise.resolve();

  assert.equal(provider.iconForVideo("C:/cats/empty.mp4"), undefined);
  assert.equal(provider.iconForVideo("C:/cats/broken.mp4"), undefined);
  assert.equal(readyCount, 0);
});

test("can invalidate cached pet tray thumbnails after local material changes", async () => {
  let revision = 0;
  const provider = new PetTrayIconProvider({
    createThumbnailFromPath: async (videoPath) => ({
      id: `thumb:${videoPath}:${revision}`,
      isEmpty: () => false
    })
  });

  provider.iconForVideo("C:/cats/idle.mp4");
  await Promise.resolve();
  assert.equal(
    (provider.iconForVideo("C:/cats/idle.mp4") as { id?: string } | undefined)?.id,
    "thumb:C:/cats/idle.mp4:0"
  );

  revision = 1;
  provider.invalidate();
  provider.iconForVideo("C:/cats/idle.mp4");
  await Promise.resolve();

  assert.equal(
    (provider.iconForVideo("C:/cats/idle.mp4") as { id?: string } | undefined)?.id,
    "thumb:C:/cats/idle.mp4:1"
  );
});
