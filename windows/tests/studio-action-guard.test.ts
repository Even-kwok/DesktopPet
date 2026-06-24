import assert from "node:assert/strict";
import test from "node:test";
import {
  StudioActionBusyError,
  createSingleFlightActionGroup,
  studioActionKey
} from "../src/main/studio-action-guard.ts";

test("coalesces duplicate studio actions while one action is still running", async () => {
  const group = createSingleFlightActionGroup();
  let runCount = 0;
  let resolveAction: (value: string) => void = () => undefined;

  const first = group.run("sync", async () => {
    runCount += 1;
    return await new Promise<string>((resolve) => {
      resolveAction = resolve;
    });
  });
  const second = group.run("sync", async () => {
    runCount += 1;
    return "duplicate";
  });

  assert.equal(runCount, 1);
  assert.equal(second, first);

  resolveAction("finished");

  assert.equal(await first, "finished");
  assert.equal(await second, "finished");
});

test("rejects a different studio action instead of reusing the in-flight result", async () => {
  const group = createSingleFlightActionGroup();
  let runCount = 0;

  const first = group.run("addFriend", async () => {
    runCount += 1;
    return await new Promise<string>(() => undefined);
  });

  await assert.rejects(
    group.run("removeFriend", async () => {
      runCount += 1;
      return "removed";
    }),
    (error) =>
      error instanceof StudioActionBusyError &&
      error.message === "操作正在进行中，请稍候。"
  );

  assert.equal(runCount, 1);
  first.catch(() => undefined);
});

test("builds stable studio action keys from the action target", () => {
  assert.equal(
    studioActionKey("addFriend", " friend@example.com "),
    studioActionKey("addFriend", "friend@example.com")
  );
  assert.notEqual(
    studioActionKey("removeFriend", "friend_1"),
    studioActionKey("removeFriend", "friend_2")
  );
  assert.notEqual(
    studioActionKey("requestHosting", "pet_1", "friend_1"),
    studioActionKey("requestHosting", "pet_1", "friend_2")
  );
});

test("allows a later studio action after the current one settles", async () => {
  const group = createSingleFlightActionGroup();
  let runCount = 0;

  assert.equal(
    await group.run("sync", async () => {
      runCount += 1;
      return "first";
    }),
    "first"
  );
  assert.equal(
    await group.run("sync", async () => {
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
    group.run("sync", async () => {
      runCount += 1;
      throw new Error("network down");
    }),
    /network down/
  );

  assert.equal(
    await group.run("sync", async () => {
      runCount += 1;
      return "recovered";
    }),
    "recovered"
  );
  assert.equal(runCount, 2);
});
