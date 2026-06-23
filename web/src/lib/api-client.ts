import type {
  BackendStatus,
  CurrentUser,
  DesktopPetBundle,
  DesktopPetBundlePublishResponse,
  GenerationJob,
  Pet,
  PetCreateResponse,
  PetDeleteResponse,
  PetMaterialSaveResponse,
  SourceImageUploadResponse,
  StudioBootstrap,
  UploadUrlResponse
} from "@/lib/types";

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

function networkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/failed to fetch|load failed|networkerror|fetch failed/i.test(message)) {
    return "网络请求失败，请检查网络后重试；如果刚刚登录过，请刷新页面再试。";
  }

  return message ? `请求发送失败：${message}` : "请求发送失败，请稍后重试。";
}

async function requestJSON<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...options.headers
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    throw new Error(networkErrorMessage(error));
  }

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

export function updateAccountProfile(input: {
  name: string;
}) {
  return requestJSON<{ user: CurrentUser }>("/api/account/profile", {
    method: "PATCH",
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
  sourceImageUrl?: string;
  lastImageUrl?: string;
}) {
  return requestJSON<GenerationJob>("/api/generation/action-video", {
    method: "POST",
    body: input
  });
}

export function getGenerationJob(jobId: string) {
  return requestJSON<GenerationJob>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export function getStudioBootstrap() {
  return requestJSON<StudioBootstrap>("/api/studio/bootstrap");
}

export function publishDesktopPetBundle(bundle: DesktopPetBundle) {
  return requestJSON<DesktopPetBundlePublishResponse>("/api/desktop/pets", {
    method: "POST",
    body: bundle
  });
}

export function createPet(input: { name?: string } = {}) {
  return requestJSON<PetCreateResponse>("/api/pets", {
    method: "POST",
    body: input
  });
}

export function deletePet(input: {
  petId: string;
  confirmation: "永久删除";
}) {
  return requestJSON<PetDeleteResponse>(`/api/pets/${encodeURIComponent(input.petId)}/delete`, {
    method: "POST",
    body: {
      confirmation: input.confirmation
    }
  });
}

export function updatePetName(input: {
  petId: string;
  name: string;
}) {
  return requestJSON<{ pet: Pet }>(`/api/pets/${encodeURIComponent(input.petId)}`, {
    method: "PATCH",
    body: {
      name: input.name
    }
  });
}

export function savePetMaterial(input: {
  petId: string;
  slot: string;
  videoUrl: string;
}) {
  return requestJSON<PetMaterialSaveResponse>(
    `/api/pets/${encodeURIComponent(input.petId)}/materials`,
    {
      method: "PATCH",
      body: {
        slot: input.slot,
        videoUrl: input.videoUrl
      }
    }
  );
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
