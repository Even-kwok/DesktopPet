import assert from "node:assert/strict";
import test from "node:test";
import {
  nextPetPlaybackRequest,
  nextPetVisualEffectRequest,
  petCommandFromUnknown,
  toVideoSource
} from "../src/renderer/pet/pet-playback-command.ts";

test("normalizes Windows and URL video sources", () => {
  assert.equal(toVideoSource("C:\\cats\\idle loop.mp4"), "file:///C:/cats/idle%20loop.mp4");
  assert.equal(toVideoSource("/Users/demo/idle loop.mp4"), "file:///Users/demo/idle%20loop.mp4");
  assert.equal(toVideoSource("https://example.com/idle.mp4"), "https://example.com/idle.mp4");
});

test("escapes URL delimiters in local video file names", () => {
  assert.equal(
    toVideoSource("C:\\cats\\idle #1?.mp4"),
    "file:///C:/cats/idle%20%231%3F.mp4"
  );
  assert.equal(
    toVideoSource("/Users/demo/100% ready#idle.mov"),
    "file:///Users/demo/100%25%20ready%23idle.mov"
  );
});

test("normalizes Windows UNC network share paths", () => {
  assert.equal(
    toVideoSource("\\\\NAS\\Cats\\idle loop.mp4"),
    "file://NAS/Cats/idle%20loop.mp4"
  );
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

test("advances visual effect request revision for repeated drop bounces", () => {
  const first = nextPetVisualEffectRequest(undefined, "dropBounce");
  const second = nextPetVisualEffectRequest(first, "dropBounce");

  assert.equal(first.effect, "dropBounce");
  assert.equal(second.effect, "dropBounce");
  assert.equal(second.revision, first.revision + 1);
});

test("accepts only well-formed pet renderer commands", () => {
  assert.deepEqual(petCommandFromUnknown({ type: "pause" }), { type: "pause" });
  assert.deepEqual(petCommandFromUnknown({ type: "playDropBounce" }), {
    type: "playDropBounce"
  });
  assert.deepEqual(
    petCommandFromUnknown({
      type: "loadVideo",
      petIndex: 0,
      videoPath: "C:\\cats\\idle.mp4",
      mode: "loop"
    }),
    {
      type: "loadVideo",
      petIndex: 0,
      videoPath: "C:\\cats\\idle.mp4",
      mode: "loop"
    }
  );
});

test("rejects malformed pet renderer load commands before normalizing video paths", () => {
  assert.equal(
    petCommandFromUnknown({
      type: "loadVideo",
      petIndex: 0,
      mode: "loop"
    }),
    undefined
  );
  assert.equal(
    petCommandFromUnknown({
      type: "loadVideo",
      petIndex: 0,
      videoPath: "   ",
      mode: "loop"
    }),
    undefined
  );
  assert.equal(
    petCommandFromUnknown({
      type: "loadVideo",
      petIndex: 0,
      videoPath: "C:\\cats\\idle.mp4",
      mode: "bad"
    }),
    undefined
  );
  assert.equal(
    petCommandFromUnknown({
      type: "loadVideo",
      petIndex: -1,
      videoPath: "C:\\cats\\idle.mp4",
      mode: "loop"
    }),
    undefined
  );
});
