import test from "node:test";
import assert from "node:assert/strict";

import { extractSeedanceResultUrl } from "./seedance-response.ts";

test("extracts the generated video URL from Seedance task content", () => {
  assert.equal(
    extractSeedanceResultUrl({
      id: "cgt-test",
      status: "succeeded",
      content: {
        video_url: "https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/cat.mp4"
      }
    }),
    "https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/cat.mp4"
  );
});

test("does not treat generic image URLs as generated videos", () => {
  assert.equal(
    extractSeedanceResultUrl({
      id: "cgt-test",
      status: "succeeded",
      content: {
        url: "https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/cat.png"
      }
    }),
    null
  );
});
