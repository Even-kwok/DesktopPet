import {
  defaultVideoGenerationSettings,
  type VideoGenerationSettings
} from "./generation-settings.ts";
import type { MaterialGroup, MaterialGroupId, MaterialSlot } from "./material-slots";

export type MaterialLibraryConfig = {
  code: string;
  name: string;
  nameEditable: true;
  icon: string;
  group: {
    id: MaterialGroupId;
    name: string;
    description: string;
  };
  trigger: {
    label: string;
    editable: false;
    changeRequiresClientRelease: true;
    note: string;
  };
  durationSeconds: number;
  durationEditable: true;
  creditsPerSecond: number;
  costCredits: number;
  costRule: string;
  promptContent: string;
  promptEditable: true;
  generationSettings: VideoGenerationSettings;
  enabled: boolean;
  updatedAt: string;
};

export type MaterialLibraryGroup = {
  id: MaterialGroupId;
  name: string;
  description: string;
  materials: MaterialLibraryConfig[];
};

export type MaterialLibraryUpdate = {
  name?: string;
  groupId?: MaterialGroupId;
  durationSeconds?: number;
  creditsPerSecond?: number;
  promptContent?: string;
  enabled?: boolean;
};

const defaultUpdatedAt = "2026-06-16T00:00:00.000Z";

export function buildMaterialLibraryConfigs(
  slots: MaterialSlot[],
  groups: MaterialGroup[],
  updatedAt = defaultUpdatedAt
) {
  return slots.map((slot) => {
    const group = groupForId(slot.group, groups);
    const creditsPerSecond = rateForCost(slot.cost, slot.durationSeconds);

    return createMaterialLibraryConfig({
      code: slot.id,
      name: slot.name,
      icon: slot.icon,
      group,
      triggerLabel: slot.trigger,
      durationSeconds: slot.durationSeconds,
      creditsPerSecond,
      promptContent: defaultPromptForSlot(slot),
      enabled: true,
      updatedAt
    });
  });
}

export function updateMaterialLibraryConfig(
  current: MaterialLibraryConfig,
  patch: MaterialLibraryUpdate,
  groups: MaterialGroup[] = []
): MaterialLibraryConfig {
  const group =
    patch.groupId && patch.groupId !== current.group.id
      ? groupForId(patch.groupId, groups)
      : current.group;
  const durationSeconds =
    typeof patch.durationSeconds === "number"
      ? clampDuration(patch.durationSeconds)
      : current.durationSeconds;
  const creditsPerSecond =
    typeof patch.creditsPerSecond === "number"
      ? clampCreditsPerSecond(patch.creditsPerSecond)
      : current.creditsPerSecond;

  return createMaterialLibraryConfig({
    code: current.code,
    name: cleanEditableText(patch.name) ?? current.name,
    icon: current.icon,
    group,
    triggerLabel: current.trigger.label,
    durationSeconds,
    creditsPerSecond,
    promptContent: cleanPrompt(patch.promptContent) ?? current.promptContent,
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    updatedAt: new Date().toISOString()
  });
}

export function groupMaterialLibraryConfigs(
  configs: MaterialLibraryConfig[],
  groups: MaterialGroup[]
): MaterialLibraryGroup[] {
  return groups.map((group) => ({
    id: group.id,
    name: group.title,
    description: group.description,
    materials: configs.filter((config) => config.group.id === group.id)
  }));
}

export function toPublicMaterialSlot(config: MaterialLibraryConfig): MaterialSlot {
  return {
    id: config.code,
    name: config.name,
    trigger: config.trigger.label,
    cost: config.costCredits,
    durationSeconds: config.durationSeconds,
    group: config.group.id,
    icon: config.icon
  };
}

export function createMaterialLibraryConfig(input: {
  code: string;
  name: string;
  icon: string;
  group: MaterialLibraryConfig["group"];
  triggerLabel: string;
  durationSeconds: number;
  creditsPerSecond: number;
  promptContent: string;
  enabled: boolean;
  updatedAt: string;
}): MaterialLibraryConfig {
  const durationSeconds = clampDuration(input.durationSeconds);
  const creditsPerSecond = clampCreditsPerSecond(input.creditsPerSecond);
  const costCredits = calculateCost(durationSeconds, creditsPerSecond);

  return {
    code: input.code,
    name: input.name,
    nameEditable: true,
    icon: input.icon,
    group: input.group,
    trigger: {
      label: input.triggerLabel,
      editable: false,
      changeRequiresClientRelease: true,
      note: "触发条件由桌面端交互逻辑决定，后台只展示，不直接改动。"
    },
    durationSeconds,
    durationEditable: true,
    creditsPerSecond,
    costCredits,
    costRule: `${formatRate(creditsPerSecond)} 积分/秒 x ${durationSeconds}s = ${costCredits} 积分`,
    promptContent: input.promptContent,
    promptEditable: true,
    generationSettings: {
      model: defaultVideoGenerationSettings.model,
      durationSeconds,
      ratio: "adaptive",
      resolution: "720p",
      framesPerSecond: 24,
      cameraFixed: true,
      watermark: false,
      generateAudio: false,
      returnLastFrame: true
    },
    enabled: input.enabled,
    updatedAt: input.updatedAt
  };
}

function groupForId(groupId: MaterialGroupId, groups: MaterialGroup[]) {
  const group = groups.find((item) => item.id === groupId);

  return {
    id: groupId,
    name: group?.title ?? groupId,
    description: group?.description ?? ""
  };
}

function rateForCost(costCredits: number, durationSeconds: number) {
  return Number((costCredits / Math.max(1, durationSeconds)).toFixed(2));
}

function calculateCost(durationSeconds: number, creditsPerSecond: number) {
  return Math.ceil(durationSeconds * creditsPerSecond);
}

function clampDuration(value: number) {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.max(4, Math.min(15, Math.round(value)));
}

function clampCreditsPerSecond(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Number(value.toFixed(2)));
}

function cleanEditableText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanPrompt(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatRate(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function defaultPromptForSlot(slot: MaterialSlot) {
  return [
    "固定摄像机视角，只生成单只猫或狗的桌面宠物动作视频。",
    "纯绿色背景，方便后续绿幕抠像；不要出现人、文字、水印、食物碗或多余物体。",
    "宠物主体完整，尽量保持在画面中央，动作自然可爱，适合循环播放。",
    `动作状态：${slot.name}。触发场景：${slot.trigger}。`
  ].join("\n");
}
