import {
  clampVideoDuration,
  defaultVideoGenerationSettings,
  type VideoGenerationSettings
} from "@/lib/generation-settings";
import { getMaterialPrompt } from "@/lib/server/material-library-store";
import { buildSeedanceRequestBody } from "@/lib/server/seedance-request";
import {
  extractSeedanceLastFrameUrl,
  extractSeedanceResultUrl
} from "@/lib/server/seedance-response";
import type { GenerationJob, GenerationJobStatus } from "@/lib/types";
import type { SeedanceVideoModel } from "@/lib/seedance-models";
import {
  getJimengApiKey,
  getJimengBaseUrl,
  getJimengQueryUrlTemplate,
  getJimengVideoModel
} from "./jimeng-env";

type JimengConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  queryUrlTemplate: string;
  settings: VideoGenerationSettings;
};

type ProviderPayload = Record<string, unknown>;

const jobPrefix = "jimeng_";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function encodeProviderJobId(providerJobId: string) {
  return `${jobPrefix}${Buffer.from(providerJobId, "utf8").toString("base64url")}`;
}

function decodeProviderJobId(jobId: string) {
  if (!jobId.startsWith(jobPrefix)) {
    return null;
  }

  try {
    return Buffer.from(jobId.slice(jobPrefix.length), "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function numberFromEnv(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanFromEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function settingFromEnv<T extends string>(
  value: string | undefined,
  fallback: T,
  allowedValues: readonly T[]
) {
  if (!value) {
    return fallback;
  }

  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

export function getJimengConfig(modelOverride?: SeedanceVideoModel): JimengConfig | null {
  const model = modelOverride ?? getJimengVideoModel();
  const apiKey = getJimengApiKey(model);
  const baseUrl = getJimengBaseUrl();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const queryUrlTemplate = getJimengQueryUrlTemplate();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizedBaseUrl,
    model,
    queryUrlTemplate: queryUrlTemplate || `${normalizedBaseUrl}/{taskId}`,
    settings: {
      model,
      durationSeconds: clampVideoDuration(
        numberFromEnv(
          process.env.JIMENG_VIDEO_DURATION_SECONDS,
          defaultVideoGenerationSettings.durationSeconds
        )
      ),
      ratio: settingFromEnv(process.env.JIMENG_VIDEO_RATIO, defaultVideoGenerationSettings.ratio, [
        "adaptive",
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:4"
      ]),
      resolution: settingFromEnv(
        process.env.JIMENG_VIDEO_RESOLUTION,
        defaultVideoGenerationSettings.resolution,
        ["480p", "720p"]
      ),
      framesPerSecond: 24,
      cameraFixed: booleanFromEnv(
        process.env.JIMENG_VIDEO_CAMERA_FIXED,
        defaultVideoGenerationSettings.cameraFixed
      ),
      watermark: booleanFromEnv(
        process.env.JIMENG_VIDEO_WATERMARK,
        defaultVideoGenerationSettings.watermark
      ),
      generateAudio: booleanFromEnv(
        process.env.JIMENG_VIDEO_GENERATE_AUDIO,
        defaultVideoGenerationSettings.generateAudio
      ),
      returnLastFrame: booleanFromEnv(
        process.env.JIMENG_VIDEO_RETURN_LAST_FRAME,
        defaultVideoGenerationSettings.returnLastFrame
      )
    }
  };
}

export function isJimengJobId(jobId: string) {
  return jobId.startsWith(jobPrefix);
}

function createRequestBody(input: {
  sourceImageUrl: string;
  lastImageUrl?: string;
  prompt: string;
  config: JimengConfig;
  settings: VideoGenerationSettings;
}) {
  return buildSeedanceRequestBody({
    model: input.config.model,
    prompt: input.prompt,
    sourceImageUrl: input.sourceImageUrl,
    lastImageUrl: input.lastImageUrl,
    settings: input.settings
  });
}

function providerValue(payload: ProviderPayload, keys: string[]) {
  for (const key of keys) {
    const value = key.split(".").reduce<unknown>((current, part) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[part];
    }, payload);

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function providerJobId(payload: ProviderPayload) {
  return providerValue(payload, [
    "id",
    "task_id",
    "job_id",
    "data.id",
    "data.task_id",
    "data.job_id"
  ]);
}

function providerResultUrl(payload: ProviderPayload) {
  return extractSeedanceResultUrl(payload);
}

function providerStatus(payload: ProviderPayload): GenerationJobStatus {
  const rawStatus = providerValue(payload, ["status", "data.status", "data.task_status"]);
  const status = rawStatus?.toLowerCase();

  if (!status) {
    return providerResultUrl(payload) ? "succeeded" : "running";
  }

  if (["succeeded", "success", "done", "completed", "complete"].includes(status)) {
    return "succeeded";
  }

  if (["failed", "error", "canceled", "cancelled"].includes(status)) {
    return "failed";
  }

  if (["expired", "timeout", "timed_out"].includes(status)) {
    return "expired";
  }

  if (["queued", "pending", "created", "submitted"].includes(status)) {
    return "queued";
  }

  return "running";
}

function providerErrorMessage(payload: ProviderPayload) {
  return providerValue(payload, [
    "error.message",
    "message",
    "data.error.message",
    "data.message",
    "msg"
  ]);
}

async function parseProviderResponse(response: Response) {
  const text = await response.text();
  let payload: ProviderPayload = {};

  if (text) {
    try {
      payload = JSON.parse(text) as ProviderPayload;
    } catch {
      payload = { message: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const message = providerErrorMessage(payload) || response.statusText || "Provider request failed";
    throw new Error(`${message} (${response.status})`);
  }

  return payload;
}

export async function createJimengVideoJob(input: {
  petId: string;
  slot: string;
  sourceImageUrl: string;
  lastImageUrl?: string;
  settings?: VideoGenerationSettings;
  cost: number;
}): Promise<GenerationJob | null> {
  const config = getJimengConfig(input.settings?.model);

  if (!config) {
    return null;
  }

  const settings = {
    ...config.settings,
    ...input.settings,
    durationSeconds: clampVideoDuration(input.settings?.durationSeconds ?? config.settings.durationSeconds)
  };
  const prompt = await getMaterialPrompt(input.slot);

  if (!prompt) {
    throw new Error(`Unknown material prompt: ${input.slot}`);
  }

  const requestBody = createRequestBody({
    sourceImageUrl: input.sourceImageUrl,
    lastImageUrl: input.lastImageUrl,
    prompt,
    config,
    settings
  });

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const payload = await parseProviderResponse(response);
  const taskId = providerJobId(payload);

  if (!taskId) {
    throw new Error("Provider did not return a task id.");
  }

  return {
    jobId: encodeProviderJobId(taskId),
    type: "action_video",
    status: "queued",
    cost: input.cost,
    petId: input.petId,
    slot: input.slot,
    progress: 0,
    resultUrl: providerResultUrl(payload),
    lastFrameUrl: extractSeedanceLastFrameUrl(payload),
    message: "Jimeng video generation task created.",
    createdAt: new Date().toISOString(),
    settings,
    sourceImageUrl: input.sourceImageUrl,
    lastImageUrl: input.lastImageUrl ?? input.sourceImageUrl
  };
}

export async function getJimengVideoJob(jobId: string): Promise<GenerationJob | null> {
  const providerTaskId = decodeProviderJobId(jobId);
  const config = getJimengConfig();

  if (!providerTaskId || !config) {
    return null;
  }

  const url = config.queryUrlTemplate.replace("{taskId}", encodeURIComponent(providerTaskId));
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${config.apiKey}`
    }
  });
  const payload = await parseProviderResponse(response);
  const status = providerStatus(payload);

  return {
    jobId,
    type: "action_video",
    status,
    cost: 0,
    petId: "pet_orange",
    progress: status === "succeeded" || status === "failed" || status === "expired" ? 100 : 60,
    resultUrl: providerResultUrl(payload),
    lastFrameUrl: extractSeedanceLastFrameUrl(payload),
    message: providerErrorMessage(payload) || "Jimeng provider status fetched.",
    createdAt: new Date().toISOString()
  };
}
