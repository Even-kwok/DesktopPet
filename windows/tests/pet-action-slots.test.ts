import assert from "node:assert/strict";
import test from "node:test";
import {
  allPetActionSlots,
  clickReactionSlots,
  idleRandomActionSlots,
  materialGroupForSlot,
  matchingNearbyResponseSlot,
  mouseoverCatchSlots,
  nearbyPetInteractionSlots,
  petActionSlotDisplayName,
  petSizeScaleOptions
} from "../src/shared/pet-action-slots.ts";

test("matches the Mac material slot order and labels", () => {
  assert.deepEqual(allPetActionSlots, [
    "idle_loop",
    "catch_bug",
    "catch_bug_up",
    "click_react",
    "head_rub_left",
    "head_rub_right",
    "angry_swipe_left",
    "angry_swipe_right",
    "yawn",
    "lick_belly",
    "lick_back",
    "stretch",
    "happy",
    "disgusted",
    "full_wash_face",
    "hungry_meow",
    "clingy",
    "aloof",
    "belly_up",
    "look_at_camera",
    "salary_cat_stinky_dance",
    "head_bob_dance",
    "sleep_loop"
  ]);
  assert.equal(petActionSlotDisplayName("idle_loop"), "待机循环");
  assert.equal(petActionSlotDisplayName("salary_cat_stinky_dance"), "跳月薪喵散屁舞");
  assert.equal(petActionSlotDisplayName("sleep_loop"), "睡觉");
});

test("groups trigger pools like the Mac app", () => {
  assert.deepEqual(mouseoverCatchSlots, ["catch_bug", "catch_bug_up"]);
  assert.deepEqual(clickReactionSlots, [
    "click_react",
    "happy",
    "disgusted",
    "clingy",
    "aloof",
    "belly_up"
  ]);
  assert.deepEqual(idleRandomActionSlots, [
    "yawn",
    "lick_belly",
    "lick_back",
    "stretch",
    "happy",
    "disgusted",
    "full_wash_face",
    "hungry_meow",
    "clingy",
    "aloof",
    "belly_up",
    "look_at_camera",
    "salary_cat_stinky_dance",
    "head_bob_dance"
  ]);
});

test("pairs nearby pet interactions by side and action type", () => {
  assert.deepEqual(nearbyPetInteractionSlots("left"), ["head_rub_left", "angry_swipe_left"]);
  assert.deepEqual(nearbyPetInteractionSlots("right"), ["head_rub_right", "angry_swipe_right"]);
  assert.equal(matchingNearbyResponseSlot("head_rub_left"), "head_rub_right");
  assert.equal(matchingNearbyResponseSlot("angry_swipe_right"), "angry_swipe_left");
  assert.equal(matchingNearbyResponseSlot("happy"), undefined);
});

test("classifies material groups and size choices", () => {
  assert.equal(materialGroupForSlot("idle_loop"), "core");
  assert.equal(materialGroupForSlot("click_react"), "pointer");
  assert.equal(materialGroupForSlot("head_rub_left"), "nearbyPet");
  assert.equal(materialGroupForSlot("look_at_camera"), "idleLife");
  assert.equal(materialGroupForSlot("hungry_meow"), "feeding");
  assert.deepEqual(petSizeScaleOptions, [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
});
