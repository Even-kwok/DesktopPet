import { materialSlots } from "./material-slots";

export type VideoGenerationSettings = {
  durationSeconds: number;
  ratio: "adaptive" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  resolution: "480p" | "720p";
  framesPerSecond: 24;
  cameraFixed: boolean;
  watermark: boolean;
  generateAudio: boolean;
  returnLastFrame: boolean;
};

export const defaultVideoGenerationSettings: VideoGenerationSettings = {
  durationSeconds: 10,
  ratio: "adaptive",
  resolution: "720p",
  framesPerSecond: 24,
  cameraFixed: true,
  watermark: false,
  generateAudio: false,
  returnLastFrame: true
};

export const videoRatioOptions = [
  { label: "自适应", value: "adaptive" },
  { label: "1:1", value: "1:1" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" }
] as const;

export const videoResolutionOptions = [
  { label: "480p", value: "480p" },
  { label: "720p", value: "720p" }
] as const;

export const videoFpsOptions = [
  { label: "24 FPS", value: 24 }
] as const;

export function buildSlotPrompt(slotId: string) {
  const slot = materialSlots.find((item) => item.id === slotId);
  const slotName = slot?.name ?? slotId;
  const trigger = slot?.trigger ?? "桌面宠物动作";

  return [
    "固定摄像机视角，只生成单只猫或狗的桌面宠物动作视频。",
    "纯绿色背景，方便后续绿幕抠像；不要出现人、文字、水印、食物碗或多余物体。",
    "宠物主体完整，尽量保持在画面中央，动作自然可爱，适合循环播放。",
    `动作状态：${slotName}。触发场景：${trigger}。`
  ].join("\n");
}

export function clampVideoDuration(value: number) {
  if (!Number.isFinite(value)) {
    return defaultVideoGenerationSettings.durationSeconds;
  }

  return Math.max(4, Math.min(15, Math.round(value)));
}
