import assert from "node:assert/strict";
import test from "node:test";
import { createLatestEventBuffer } from "../src/preload/event-buffer.ts";

test("replays the latest command when a renderer subscribes after preload receives it", () => {
  const scheduled: Array<() => void> = [];
  const received: string[] = [];
  const buffer = createLatestEventBuffer<string>((callback) => scheduled.push(callback));

  buffer.emit("load-idle");
  const unsubscribe = buffer.subscribe((command) => received.push(command));

  assert.deepEqual(received, []);
  assert.equal(scheduled.length, 1);

  scheduled[0]();
  assert.deepEqual(received, ["load-idle"]);

  unsubscribe();
});

test("delivers live commands to current subscribers without replaying stale commands", () => {
  const scheduled: Array<() => void> = [];
  const received: string[] = [];
  const buffer = createLatestEventBuffer<string>((callback) => scheduled.push(callback));
  const unsubscribe = buffer.subscribe((command) => received.push(command));

  buffer.emit("load-click");
  unsubscribe();
  buffer.subscribe((command) => received.push(`late:${command}`));

  assert.deepEqual(received, ["load-click"]);
  assert.deepEqual(scheduled, []);
});

test("does not keep a live command pending when the subscriber unsubscribes during delivery", () => {
  const scheduled: Array<() => void> = [];
  const received: string[] = [];
  const buffer = createLatestEventBuffer<string>((callback) => scheduled.push(callback));
  let unsubscribe = () => {};

  unsubscribe = buffer.subscribe((command) => {
    received.push(command);
    unsubscribe();
  });

  buffer.emit("load-click");
  buffer.subscribe((command) => received.push(`late:${command}`));

  assert.deepEqual(received, ["load-click"]);
  assert.deepEqual(scheduled, []);
});

test("does not replay a pending command after the renderer unsubscribes", () => {
  const scheduled: Array<() => void> = [];
  const received: string[] = [];
  const buffer = createLatestEventBuffer<string>((callback) => scheduled.push(callback));

  buffer.emit("load-idle");
  const unsubscribe = buffer.subscribe((command) => received.push(command));
  unsubscribe();

  scheduled[0]();

  assert.deepEqual(received, []);
});

test("keeps a pending command available when the first subscriber unsubscribes before replay", () => {
  const scheduled: Array<() => void> = [];
  const received: string[] = [];
  const buffer = createLatestEventBuffer<string>((callback) => scheduled.push(callback));

  buffer.emit("load-idle");
  const unsubscribe = buffer.subscribe((command) => received.push(`first:${command}`));
  unsubscribe();
  buffer.subscribe((command) => received.push(`second:${command}`));

  assert.equal(scheduled.length, 2);

  scheduled[0]();
  assert.deepEqual(received, []);

  scheduled[1]();
  assert.deepEqual(received, ["second:load-idle"]);
});
