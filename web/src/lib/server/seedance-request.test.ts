import test from "node:test";
import assert from "node:assert/strict";

import { buildSeedanceRequestBody } from "./seedance-request.ts";

test("builds a Seedance first-last-frame request with matching images by default", () => {
  const body = buildSeedanceRequestBody({
    model: "doubao-seedance-2-0-fast-260128",
    prompt: "green screen cat yawning",
    sourceImageUrl: "https://example.com/cat.png",
    settings: {
      durationSeconds: 10,
      ratio: "adaptive",
      resolution: "720p",
      framesPerSecond: 24,
      cameraFixed: true,
      watermark: false,
      generateAudio: false,
      returnLastFrame: true
    }
  });

  const imageBlocks = body.content.filter((item) => item.type === "image_url");

  assert.equal(imageBlocks.length, 2);
  assert.deepEqual(
    imageBlocks.map((item) => ({ role: item.role, url: item.image_url.url })),
    [
      { role: "first_frame", url: "https://example.com/cat.png" },
      { role: "last_frame", url: "https://example.com/cat.png" }
    ]
  );
  assert.equal(body.duration, 10);
  assert.equal(body.ratio, "adaptive");
  assert.equal(body.resolution, "720p");
  assert.equal(body.framespersecond, 24);
  assert.equal(body.camera_fixed, true);
  assert.equal(body.watermark, false);
  assert.equal(body.generate_audio, false);
  assert.equal(body.return_last_frame, true);
  assert.equal(body.content[0].type, "text");
  assert.equal(body.content[0].type === "text" ? body.content[0].text : "", "green screen cat yawning");
});
