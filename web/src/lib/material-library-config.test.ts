import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMaterialLibraryConfigs,
  createAdminMaterialLibraryConfig,
  deleteMaterialLibraryConfig,
  groupMaterialLibraryConfigs,
  toPublicMaterialSlot,
  updateMaterialLibraryConfig
} from "./material-library-config.ts";
import { materialGroups, materialSlots } from "./material-slots.ts";

test("material library config keeps admin prompts out of public user slots", () => {
  const configs = buildMaterialLibraryConfigs(materialSlots, materialGroups);
  const idleConfig = configs.find((config) => config.code === "idle_loop");
  const danceConfig = configs.find((config) => config.code === "head_bob_dance");

  assert.ok(idleConfig);
  assert.ok(danceConfig);
  assert.equal(idleConfig.name, "待机循环");
  assert.equal(idleConfig.unlockTier.id, "basic");
  assert.equal(danceConfig.unlockTier.id, "advanced");
  assert.match(idleConfig.promptContent, /固定摄像机视角/);
  assert.equal(idleConfig.promptEditable, true);

  const publicSlot = toPublicMaterialSlot(idleConfig);

  assert.equal(publicSlot.id, "idle_loop");
  assert.equal(publicSlot.name, "待机循环");
  assert.equal(publicSlot.cost, idleConfig.costCredits);
  assert.equal(publicSlot.durationSeconds, idleConfig.durationSeconds);
  assert.equal(publicSlot.unlockTier, "basic");
  assert.equal("promptContent" in publicSlot, false);
});

test("material library config updates admin editable fields but keeps trigger locked", () => {
  const configs = buildMaterialLibraryConfigs(materialSlots, materialGroups);
  const idleConfig = configs[0];
  const updated = updateMaterialLibraryConfig(idleConfig, {
    name: "安静待机",
    groupId: "idleLife",
    durationSeconds: 7,
    creditsPerSecond: 2,
    unlockTier: "custom",
    promptContent: "管理员改过的完整提示词",
    enabled: false,
    triggerLabel: "后台不应该改触发"
  } as Parameters<typeof updateMaterialLibraryConfig>[1] & { triggerLabel: string });

  assert.equal(updated.name, "安静待机");
  assert.equal(updated.group.id, "idleLife");
  assert.equal(updated.durationSeconds, 7);
  assert.equal(updated.creditsPerSecond, 2);
  assert.equal(updated.unlockTier.id, "custom");
  assert.equal(updated.costCredits, 14);
  assert.equal(updated.costRule, "2 积分/秒 x 7s = 14 积分");
  assert.equal(updated.promptContent, "管理员改过的完整提示词");
  assert.equal(updated.enabled, false);
  assert.equal(updated.trigger.label, idleConfig.trigger.label);
  assert.equal(updated.trigger.editable, false);

  const grouped = groupMaterialLibraryConfigs([updated], materialGroups);
  assert.equal(grouped[0].id, "core");
  assert.equal(grouped.find((group) => group.id === "idleLife")?.materials[0].name, "安静待机");
});

test("admin material library creation normalizes configurable fields", () => {
  const created = createAdminMaterialLibraryConfig(
    {
      code: "  custom-wave ",
      name: "  招手  ",
      groupId: "idleLife",
      unlockTier: "advanced",
      durationSeconds: 99,
      creditsPerSecond: 1.234,
      promptContent: "  固定摄像机视角，小猫招手，视频自然循环  ",
      enabled: true
    },
    materialGroups,
    "2026-06-21T00:00:00.000Z"
  );

  assert.equal(created.code, "custom_wave");
  assert.equal(created.name, "招手");
  assert.equal(created.group.id, "idleLife");
  assert.equal(created.unlockTier.id, "advanced");
  assert.equal(created.trigger.label, "待机随机");
  assert.equal(created.durationSeconds, 15);
  assert.equal(created.creditsPerSecond, 1.23);
  assert.equal(created.costCredits, 19);
  assert.equal(created.promptContent, "固定摄像机视角，小猫招手，视频自然循环");
  assert.equal(created.enabled, true);
});

test("admin material library deletion removes the matching config", () => {
  const configs = buildMaterialLibraryConfigs(materialSlots, materialGroups);
  const result = deleteMaterialLibraryConfig(configs, "idle_loop");

  assert.ok(result);
  assert.equal(result.deleted.code, "idle_loop");
  assert.equal(result.configs.some((config) => config.code === "idle_loop"), false);
  assert.equal(deleteMaterialLibraryConfig(configs, "missing_slot"), null);
});
