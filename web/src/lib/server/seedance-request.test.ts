import test from "node:test";
import assert from "node:assert/strict";

import { buildSeedanceRequestBody } from "./seedance-request.ts";

test("builds a Seedance first-last-frame request with matching images by default", () => {
  const body = buildSeedanceRequestBody({
    model: "doubao-seedance-2-0-fast-260128",
    prompt: "green screen cat yawning",
    sourceImageUrl: "https://example.com/cat.png",
    durationSeconds: 10,
    cameraFixed: true,
    watermark: false
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
});
