import test from "node:test";
import assert from "node:assert/strict";

import { materialSlots } from "./material-slots.ts";

test("every material slot has a fixed Seedance duration between 4 and 15 seconds", () => {
  for (const slot of materialSlots) {
    assert.equal(Number.isInteger(slot.durationSeconds), true, `${slot.id} duration must be an integer`);
    assert.equal(slot.durationSeconds >= 4, true, `${slot.id} duration must be at least 4 seconds`);
    assert.equal(slot.durationSeconds <= 15, true, `${slot.id} duration must be at most 15 seconds`);
  }
});

test("material slots include the latest requested action library additions", () => {
  const slotsById = new Map(materialSlots.map((slot) => [slot.id, slot]));

  assert.deepEqual(slotsById.get("look_at_camera"), {
    id: "look_at_camera",
    name: "看镜头",
    trigger: "待机随机",
    cost: 10,
    durationSeconds: 6,
    group: "idleLife",
    icon: "👀"
  });
  assert.deepEqual(slotsById.get("salary_cat_stinky_dance"), {
    id: "salary_cat_stinky_dance",
    name: "跳月薪喵散屁舞",
    trigger: "待机随机",
    cost: 10,
    durationSeconds: 6,
    group: "idleLife",
    icon: "🪩"
  });
  assert.deepEqual(slotsById.get("head_bob_dance"), {
    id: "head_bob_dance",
    name: "摇头晃脑舞",
    trigger: "待机随机",
    cost: 10,
    durationSeconds: 6,
    group: "idleLife",
    icon: "🎵"
  });
});
