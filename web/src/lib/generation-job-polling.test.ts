import test from "node:test";
import assert from "node:assert/strict";

import { pollGenerationJobUntilTerminal } from "./generation-job-polling.ts";
import type { GenerationJob } from "./types.ts";

const runningJob: GenerationJob = {
  jobId: "job_video",
  type: "action_video",
  status: "running",
  cost: 12,
  petId: "pet_orange",
  slot: "idle_loop",
  progress: 26
};

test("polling continues after a transient fetch failure", async () => {
  const statusErrors: string[] = [];
  const progressUpdates: GenerationJob[] = [];
  const responses: Array<GenerationJob | Error> = [
    new TypeError("Failed to fetch"),
    { ...runningJob, progress: 52 },
    { ...runningJob, status: "succeeded", progress: 100, resultUrl: "https://example.com/idle.mp4" }
  ];

  const result = await pollGenerationJobUntilTerminal({
    job: runningJob,
    maxAttempts: 3,
    wait: async () => {},
    fetchJob: async () => {
      const response = responses.shift();

      if (response instanceof Error) {
        throw response;
      }

      assert.ok(response);
      return response;
    },
    onProgress: (job) => {
      progressUpdates.push(job);
    },
    onStatusError: (error) => {
      statusErrors.push(error.message);
    }
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.resultUrl, "https://example.com/idle.mp4");
  assert.deepEqual(statusErrors, ["Failed to fetch"]);
  assert.equal(progressUpdates.some((job) => job.progress === 52), true);
});
