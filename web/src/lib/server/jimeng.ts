import { materialSlots } from "@/lib/material-slots";
import { buildSeedanceRequestBody } from "@/lib/server/seedance-request";
import { extractSeedanceResultUrl } from "@/lib/server/seedance-response";
import type { GenerationJob, GenerationJobStatus } from "@/lib/types";

type JimengConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  queryUrlTemplate: string;
  durationSeconds: number;
  cameraFixed: boolean;
  watermark: boolean;
};

type ProviderPayload = Record<string, unknown>;

const jobPrefix = "jimeng_";
const defaultBaseUrl = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
const defaultModel = "doubao-seedance-2-0-fast-260128";

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

export function getJimengConfig(): JimengConfig | null {
  const apiKey = process.env.JIMENG_API_KEY?.trim() || process.env.ARK_API_KEY?.trim();
  const baseUrl = process.env.JIMENG_API_BASE_URL?.trim() || defaultBaseUrl;
  const model = process.env.JIMENG_VIDEO_MODEL?.trim() || defaultModel;

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(baseUrl),
    model,
    queryUrlTemplate:
      process.env.JIMENG_QUERY_URL_TEMPLATE?.trim() || `${normalizeBaseUrl(baseUrl)}/{taskId}`,
    durationSeconds: numberFromEnv(process.env.JIMENG_VIDEO_DURATION_SECONDS, 10),
    cameraFixed: booleanFromEnv(process.env.JIMENG_VIDEO_CAMERA_FIXED, true),
    watermark: booleanFromEnv(process.env.JIMENG_VIDEO_WATERMARK, false)
  };
}

export function isJimengJobId(jobId: string) {
  return jobId.startsWith(jobPrefix);
}

function slotPrompt(slotId: string) {
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

function createRequestBody(input: {
  sourceImageUrl: string;
  slot: string;
  config: JimengConfig;
}) {
  return buildSeedanceRequestBody({
    model: input.config.model,
    prompt: slotPrompt(input.slot),
    sourceImageUrl: input.sourceImageUrl,
    durationSeconds: input.config.durationSeconds,
    cameraFixed: input.config.cameraFixed,
    watermark: input.config.watermark
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
  cost: number;
}): Promise<GenerationJob | null> {
  const config = getJimengConfig();

  if (!config) {
    return null;
  }

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(
      createRequestBody({
        sourceImageUrl: input.sourceImageUrl,
        slot: input.slot,
        config
      })
    )
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
    message: "Jimeng video generation task created.",
    createdAt: new Date().toISOString()
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
    progress: status === "succeeded" || status === "failed" ? 100 : 60,
    resultUrl: providerResultUrl(payload),
    message: providerErrorMessage(payload) || "Jimeng provider status fetched.",
    createdAt: new Date().toISOString()
  };
}
