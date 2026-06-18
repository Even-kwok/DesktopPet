import {
  defaultSeedanceVideoModel,
  isSeedanceVideoModel,
  seedanceVideoModelOptions,
  seedanceVideoModelValues,
  type SeedanceVideoModel
} from "./seedance-models.ts";

export { seedanceVideoModelOptions, seedanceVideoModelValues };
export type { SeedanceVideoModel };

export type VideoGenerationSettings = {
  model: SeedanceVideoModel;
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
  model: defaultSeedanceVideoModel,
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

type RawSettings = Record<string, unknown>;

export function clampVideoDuration(value: number) {
  if (!Number.isFinite(value)) {
    return defaultVideoGenerationSettings.durationSeconds;
  }

  return Math.max(4, Math.min(15, Math.round(value)));
}

export function normalizeVideoGenerationSettings(
  input: unknown,
  fallback: VideoGenerationSettings = defaultVideoGenerationSettings
): VideoGenerationSettings {
  const record = isRecord(input) ? input : {};

  return {
    model: isSeedanceVideoModel(record.model) ? record.model : fallback.model,
    durationSeconds:
      typeof record.durationSeconds === "number"
        ? clampVideoDuration(record.durationSeconds)
        : fallback.durationSeconds,
    ratio: isVideoRatio(record.ratio) ? record.ratio : fallback.ratio,
    resolution: isVideoResolution(record.resolution) ? record.resolution : fallback.resolution,
    framesPerSecond: record.framesPerSecond === 24 ? 24 : fallback.framesPerSecond,
    cameraFixed: typeof record.cameraFixed === "boolean" ? record.cameraFixed : fallback.cameraFixed,
    watermark: typeof record.watermark === "boolean" ? record.watermark : fallback.watermark,
    generateAudio:
      typeof record.generateAudio === "boolean" ? record.generateAudio : fallback.generateAudio,
    returnLastFrame:
      typeof record.returnLastFrame === "boolean"
        ? record.returnLastFrame
        : fallback.returnLastFrame
  };
}

export function patchVideoGenerationSettings(
  current: VideoGenerationSettings,
  patch: unknown
) {
  const patchRecord = isRecord(patch) ? patch : {};

  return normalizeVideoGenerationSettings({ ...current, ...patchRecord }, current);
}

function isRecord(value: unknown): value is RawSettings {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isVideoRatio(value: unknown): value is VideoGenerationSettings["ratio"] {
  return videoRatioOptions.some((option) => option.value === value);
}

function isVideoResolution(value: unknown): value is VideoGenerationSettings["resolution"] {
  return videoResolutionOptions.some((option) => option.value === value);
}
