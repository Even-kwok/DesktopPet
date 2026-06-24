import assert from "node:assert/strict";
import test from "node:test";
import { PetStateMachine } from "../src/shared/pet-state-machine.ts";

test("moves from hidden to idle and back to hidden", () => {
  const states: string[] = [];
  const machine = new PetStateMachine((state) => states.push(state));

  assert.equal(machine.state, "hidden");
  machine.send("show");
  machine.send("hide");

  assert.deepEqual(states, ["idle", "hidden"]);
  assert.equal(machine.state, "hidden");
});

test("only allows sleep from idle and wake from sleeping", () => {
  const machine = new PetStateMachine();

  machine.send("sleep");
  assert.equal(machine.state, "hidden");

  machine.send("show");
  machine.send("sleep");
  assert.equal(machine.state, "sleeping");

  machine.send("wake");
  assert.equal(machine.state, "idle");
});

test("wakes back to idle when a sleep video finishes", () => {
  const machine = new PetStateMachine();

  machine.send("show");
  machine.send("sleep");
  machine.send("reactionFinished");

  assert.equal(machine.state, "idle");
});

test("reactions return to idle after reactionFinished", () => {
  const machine = new PetStateMachine();
  machine.send("show");

  for (const event of ["click", "mouseOverPet", "idleActionDue", "nearbyPet"] as const) {
    machine.send(event);
    assert.notEqual(machine.state, "idle");
    machine.send("reactionFinished");
    assert.equal(machine.state, "idle");
  }
});

test("missing reaction videos return to idle after the Mac fallback delay", () => {
  const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
  const machine = new PetStateMachine(undefined, (callback, delayMs) => {
    scheduled.push({ callback, delayMs });
  });

  machine.send("show");
  machine.send("click");
  machine.send("reactionUnavailable");

  assert.equal(machine.state, "clicked");
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 120);

  scheduled[0].callback();
  assert.equal(machine.state, "idle");
});

test("drag ends with dropped and scheduler returns to idle", () => {
  const scheduled: Array<() => void> = [];
  const machine = new PetStateMachine(undefined, (callback) => scheduled.push(callback));

  machine.send("show");
  machine.send("dragStarted");
  assert.equal(machine.state, "grabbed");

  machine.send("dragEnded");
  assert.equal(machine.state, "dropped");
  assert.equal(scheduled.length, 1);

  scheduled[0]();
  assert.equal(machine.state, "idle");
});
