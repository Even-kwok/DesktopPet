type SeedanceRequestOptions = {
  model: string;
  prompt: string;
  sourceImageUrl: string;
  lastImageUrl?: string;
  durationSeconds: number;
  cameraFixed: boolean;
  watermark: boolean;
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
};

export function buildSeedanceRequestBody(options: SeedanceRequestOptions): SeedanceRequestBody {
  const prompt = [
    options.prompt,
    `--duration ${options.durationSeconds}`,
    `--camerafixed ${options.cameraFixed}`,
    `--watermark ${options.watermark}`
  ].join(" ");
  const lastImageUrl = options.lastImageUrl ?? options.sourceImageUrl;

  return {
    model: options.model,
    content: [
      {
        type: "text",
        text: prompt
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
    ]
  };
}
