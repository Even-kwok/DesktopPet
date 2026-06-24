import assert from "node:assert/strict";
import test from "node:test";
import { createSingleFlightActionGroup } from "../src/main/studio-action-guard.ts";

test("coalesces duplicate studio actions while one action is still running", async () => {
  const group = createSingleFlightActionGroup();
  let runCount = 0;
  let resolveAction: (value: string) => void = () => undefined;

  const first = group.run(async () => {
    runCount += 1;
    return await new Promise<string>((resolve) => {
      resolveAction = resolve;
    });
  });
  const second = group.run(async () => {
    runCount += 1;
    return "duplicate";
  });

  assert.equal(runCount, 1);
  assert.equal(second, first);

  resolveAction("finished");

  assert.equal(await first, "finished");
  assert.equal(await second, "finished");
});

test("allows a later studio action after the current one settles", async () => {
  const group = createSingleFlightActionGroup();
  let runCount = 0;

  assert.equal(
    await group.run(async () => {
      runCount += 1;
      return "first";
    }),
    "first"
  );
  assert.equal(
    await group.run(async () => {
      runCount += 1;
      return "second";
    }),
    "second"
  );

  assert.equal(runCount, 2);
});

test("allows retrying a studio action after a failed run", async () => {
  const group = createSingleFlightActionGroup();
  let runCount = 0;

  await assert.rejects(
    group.run(async () => {
      runCount += 1;
      throw new Error("network down");
    }),
    /network down/
  );

  assert.equal(
    await group.run(async () => {
      runCount += 1;
      return "recovered";
    }),
    "recovered"
  );
  assert.equal(runCount, 2);
});
