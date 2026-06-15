import type { GenerationJob, UploadUrlResponse } from "@/lib/types";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

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
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Request failed with status ${response.status}`;
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
