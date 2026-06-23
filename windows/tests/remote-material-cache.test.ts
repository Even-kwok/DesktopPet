import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  remoteMaterialDestinationPath,
  writeRemoteMaterialAtomically
} from "../src/shared/remote-material-cache.ts";

function makeTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "cat-desktop-pet-remote-cache-"));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("builds a safe remote material destination path", () => {
  const destination = remoteMaterialDestinationPath(
    "C:/Users/demo/AppData/Roaming/CatDesktopPet/RemoteMaterials",
    "pet/demo:1",
    {
      slot: "idle_loop",
      name: "待机循环",
      videoUrl: "https://example.com/videos/idle.mov?download=1",
      status: "ready"
    }
  );

  assert.match(destination.replace(/\\/g, "/"), /RemoteMaterials\/pet-demo-1\/idle_loop\.mov$/);
});

test("writes remote material through a sibling temp file before replacing destination", async () => {
  const { dir, cleanup } = makeTempDir();
  try {
    const destination = path.join(dir, "idle_loop.mp4");
    writeFileSync(destination, "old-cache");

    await writeRemoteMaterialAtomically(destination, Buffer.from("new-cache"));

    assert.equal(readFileSync(destination, "utf8"), "new-cache");
  } finally {
    cleanup();
  }
});

test("keeps existing cache when atomic replace fails", async () => {
  const { dir, cleanup } = makeTempDir();
  try {
    const destination = path.join(dir, "idle_loop.mp4");
    const tempFiles: string[] = [];
    writeFileSync(destination, "old-cache");

    await assert.rejects(
      writeRemoteMaterialAtomically(destination, Buffer.from("new-cache"), {
        rename: async (source) => {
          tempFiles.push(String(source));
          throw new Error("rename failed");
        }
      }),
      /rename failed/
    );

    assert.equal(readFileSync(destination, "utf8"), "old-cache");
    assert.equal(tempFiles.length, 1);
    assert.throws(() => readFileSync(tempFiles[0], "utf8"));
  } finally {
    cleanup();
  }
});
