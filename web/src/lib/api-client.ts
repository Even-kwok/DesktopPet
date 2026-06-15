import type { BackendStatus, GenerationJob, SourceImageUploadResponse, UploadUrlResponse } from "@/lib/types";
import type { VideoGenerationSettings } from "@/lib/generation-settings";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function errorMessageFromPayload(
  payload: unknown,
  fallback: string
) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const error = typeof record.error === "string" ? record.error : fallback;
  const details = typeof record.details === "string" ? record.details : "";

  return details ? `${error}: ${details}` : error;
}

async function requestJSON<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = errorMessageFromPayload(payload, `Request failed with status ${response.status}`);
    throw new Error(message);
  }

  return payload as T;
}

export function requestUploadUrl(input: {
  petId: string;
  fileName: string;
  contentType: string;
}) {
  return requestJSON<UploadUrlResponse>("/api/upload-url", {
    method: "POST",
    body: input
  });
}

export async function uploadSourceImage(input: {
  petId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("petId", input.petId);
  formData.append("file", input.file);

  const response = await fetch("/api/source-images", {
    method: "POST",
    body: formData
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = errorMessageFromPayload(payload, `Upload failed with status ${response.status}`);
    throw new Error(message);
  }

  return payload as SourceImageUploadResponse;
}

export function getBackendStatus() {
  return requestJSON<BackendStatus>("/api/backend/status");
}

export function createFrontImageJob(input: {
  petId: string;
  sourceImageUrl: string;
}) {
  return requestJSON<GenerationJob>("/api/generation/front-image", {
    method: "POST",
    body: input
  });
}

export function createActionVideoJob(input: {
  petId: string;
  slot: string;
  sourceImageUrl?: string;
  lastImageUrl?: string;
  settings?: VideoGenerationSettings;
}) {
  return requestJSON<GenerationJob>("/api/generation/action-video", {
    method: "POST",
    body: input
  });
}

export function getGenerationJob(jobId: string) {
  return requestJSON<GenerationJob>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function sendHostingRequest(input: {
  petId: string;
  toUserId: string;
}) {
  return requestJSON<{ requestId: string; status: string }>("/api/hosting/requests", {
    method: "POST",
    body: input
  });
}

export function updateHostingRequest(input: {
  requestId: string;
  action: "accept" | "decline" | "return";
}) {
  return requestJSON<{ requestId: string; status: string }>(
    `/api/hosting/requests/${encodeURIComponent(input.requestId)}`,
    {
      method: "PATCH",
      body: {
        action: input.action
      }
    }
  );
}

export function recallPet(input: { petId: string }) {
  return requestJSON<{ petId: string; status: string }>("/api/hosting/recall", {
    method: "POST",
    body: input
  });
}
