import type { VideoGenerationSettings } from "@/lib/generation-settings";

type SeedanceRequestOptions = {
  model: string;
  prompt: string;
  sourceImageUrl: string;
  lastImageUrl?: string;
  settings: VideoGenerationSettings;
};

type SeedanceTextBlock = {
  type: "text";
  text: string;
};

type SeedanceImageBlock = {
  type: "image_url";
  role: "first_frame" | "last_frame";
  image_url: {
    url: string;
  };
};

export type SeedanceRequestBody = {
  model: string;
  content: Array<SeedanceTextBlock | SeedanceImageBlock>;
  duration: number;
  ratio: string;
  resolution: string;
  framespersecond: number;
  watermark: boolean;
  generate_audio: boolean;
  return_last_frame: boolean;
};

export function buildSeedanceRequestBody(options: SeedanceRequestOptions): SeedanceRequestBody {
  const lastImageUrl = options.lastImageUrl ?? options.sourceImageUrl;

  return {
    model: options.model,
    content: [
      {
        type: "text",
        text: options.prompt
      },
      {
        type: "image_url",
        role: "first_frame",
        image_url: {
          url: options.sourceImageUrl
        }
      },
      {
        type: "image_url",
        role: "last_frame",
        image_url: {
          url: lastImageUrl
        }
      }
    ],
    duration: options.settings.durationSeconds,
    ratio: options.settings.ratio,
    resolution: options.settings.resolution,
    framespersecond: options.settings.framesPerSecond,
    watermark: options.settings.watermark,
    generate_audio: options.settings.generateAudio,
    return_last_frame: options.settings.returnLastFrame
  };
}
