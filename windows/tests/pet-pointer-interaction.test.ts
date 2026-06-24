import assert from "node:assert/strict";
import test from "node:test";
import { createPetPointerInteraction } from "../src/renderer/pet/pet-pointer-interaction.ts";

test("clicks when a pointer up completes without meaningful movement", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`)
  });

  interaction.pointerDown({ screenX: 100, screenY: 100 });
  interaction.pointerMove({ screenX: 101, screenY: 101 });
  interaction.pointerUp();

  assert.deepEqual(events, ["dragBy:1,1", "click"]);
});

test("drags without changing the pet animation state", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`)
  });

  interaction.pointerDown({ screenX: 100, screenY: 100 });
  interaction.pointerMove({ screenX: 104, screenY: 100 });
  interaction.pointerUp();

  assert.deepEqual(events, ["dragBy:4,0"]);
});

test("cancels active drag without changing the pet animation state", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`)
  });

  interaction.pointerDown({ screenX: 100, screenY: 100 });
  interaction.pointerMove({ screenX: 108, screenY: 103 });
  interaction.pointerCancel();

  assert.deepEqual(events, ["dragBy:8,3"]);
});

test("does not click when a tap is canceled before pointer up", () => {
  const events: string[] = [];
  const interaction = createPetPointerInteraction({
    onClick: () => events.push("click"),
    onDragBy: (delta) => events.push(`dragBy:${delta.x},${delta.y}`)
  });

  interaction.pointerDown({ screenX: 40, screenY: 40 });
  interaction.pointerCancel();
  interaction.pointerUp();

  assert.deepEqual(events, []);
});
