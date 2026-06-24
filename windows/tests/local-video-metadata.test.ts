import assert from "node:assert/strict";
import test from "node:test";
import { videoMetadataProbeScript } from "../src/shared/local-video-metadata-script.ts";

test("metadata probe script reads duration and visible video dimensions", () => {
  const script = videoMetadataProbeScript("file:///C:/cats/idle%20loop.mp4");

  assert.match(script, /video\.duration/);
  assert.match(script, /video\.videoWidth > 0 && video\.videoHeight > 0/);
  assert.match(script, /file:\/\/\/C:\/cats\/idle%20loop\.mp4/);
});

test("metadata probe script marks timeout and media errors as unreadable", () => {
  const script = videoMetadataProbeScript("file:///C:/cats/broken.mp4");

  assert.match(script, /readError: true/);
  assert.match(script, /readError: false/);
});
