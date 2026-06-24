import assert from "node:assert/strict";
import test from "node:test";
import { createPetPointerInteraction } from "../src/renderer/pet/pet-pointer-interaction.ts";

test("clicks when a pointer up completes without meaningful movement", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragStarted: () => events.push("dragStarted"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`),
    onDragEnded: () => events.push("dragEnded")
  });

  interaction.pointerDown({ screenX: 100, screenY: 100 });
  interaction.pointerMove({ screenX: 101, screenY: 101 });
  interaction.pointerUp();

  assert.deepEqual(events, ["dragBy:1,1", "click"]);
});

test("ends an active drag on pointer up", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragStarted: () => events.push("dragStarted"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`),
    onDragEnded: () => events.push("dragEnded")
  });

  interaction.pointerDown({ screenX: 100, screenY: 100 });
  interaction.pointerMove({ screenX: 104, screenY: 100 });
  interaction.pointerUp();

  assert.deepEqual(events, ["dragStarted", "dragBy:4,0", "dragEnded"]);
});

test("ends an active drag when pointer capture is canceled", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragStarted: () => events.push("dragStarted"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`),
    onDragEnded: () => events.push("dragEnded")
  });

  interaction.pointerDown({ screenX: 100, screenY: 100 });
  interaction.pointerMove({ screenX: 108, screenY: 103 });
  interaction.pointerCancel();

  assert.deepEqual(events, ["dragStarted", "dragBy:8,3", "dragEnded"]);
});

test("does not click when a tap is canceled before pointer up", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragStarted: () => events.push("dragStarted"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`),
    onDragEnded: () => events.push("dragEnded")
  });

  interaction.pointerDown({ screenX: 40, screenY: 40 });
  interaction.pointerCancel();
  interaction.pointerUp();

  assert.deepEqual(events, []);
});
