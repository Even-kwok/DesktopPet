import assert from "node:assert/strict";
import test from "node:test";
import {
  nextPetPlaybackRequest,
  toVideoSource
} from "../src/renderer/pet/pet-playback-command.ts";

test("normalizes Windows and URL video sources", () => {
  assert.equal(toVideoSource("C:\\cats\\idle loop.mp4"), "file:///C:/cats/idle%20loop.mp4");
  assert.equal(toVideoSource("/Users/demo/idle loop.mp4"), "file:///Users/demo/idle%20loop.mp4");
  assert.equal(toVideoSource("https://example.com/idle.mp4"), "https://example.com/idle.mp4");
});

test("advances playback request revision even when source path repeats", () => {
  const first = nextPetPlaybackRequest(undefined, {
    petIndex: 0,
    videoPath: "C:\\cats\\same.mp4",
    mode: "loop"
  });
  const second = nextPetPlaybackRequest(first, {
    petIndex: 0,
    videoPath: "C:\\cats\\same.mp4",
    mode: "playOnce"
  });

  assert.equal(first.source, second.source);
  assert.equal(first.mode, "loop");
  assert.equal(second.mode, "playOnce");
  assert.equal(second.revision, first.revision + 1);
});
