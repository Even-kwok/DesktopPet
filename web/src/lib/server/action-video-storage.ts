import { getStorageBuckets, getSupabaseAdminClient } from "../supabase/server.ts";

const maxActionVideoBytes = 80 * 1024 * 1024;
const stableExternalVideoHosts = new Set(["github.com"]);
const supportedVideoExtensions = new Set(["mp4", "m4v", "mov", "webm"]);
const blockedDownloadContentTypes = new Set([
  "application/json",
  "application/xml",
  "text/html",
  "text/plain",
  "text/xml"
]);

type PersistActionVideoInput = {
  petId: string;
  slot: string;
  jobId: string;
  videoUrl: string;
};

export function shouldMirrorActionVideoUrl(videoUrl: string, bucket = getStorageBuckets().actionVideos) {
  const parsed = safeURL(videoUrl);

  if (!parsed) {
    return false;
  }

  if (stableExternalVideoHosts.has(parsed.hostname)) {
    return false;
  }

  if (parsed.hostname.endsWith(".supabase.co")) {
    return !parsed.pathname.includes(`/storage/v1/object/public/${bucket}/`);
  }

  return true;
}

export function actionVideoStoragePath(input: {
  petId: string;
  slot: string;
  jobId: string;
  extension?: string | null;
}) {
  const extension = normalizeVideoExtension(input.extension);

  return [
    safeStoragePathPart(input.petId),
    safeStoragePathPart(input.slot),
    `${safeStoragePathPart(input.jobId)}.${extension}`
  ].join("/");
}

export function isActionVideoNotVideoError(error: unknown) {
  return error instanceof Error && error.message === "ACTION_VIDEO_NOT_VIDEO";
}

export function isAcceptableActionVideoDownload(input: {
  contentType: string | null;
  pathname: string | null | undefined;
}) {
  const contentType = normalizedContentType(input.contentType);

  if (contentType?.startsWith("video/")) {
    return true;
  }

  if (contentType?.startsWith("image/") || (contentType && blockedDownloadContentTypes.has(contentType))) {
    return false;
  }

  return hasSupportedVideoExtension(input.pathname);
}

export async function persistActionVideoUrl(input: PersistActionVideoInput): Promise<string> {
  const bucket = getStorageBuckets().actionVideos;
  const parsed = safeURL(input.videoUrl);
  const shouldMirror = shouldMirrorActionVideoUrl(input.videoUrl, bucket);

  if (!shouldMirror && !isLikelyActionVideoUrl(input.videoUrl)) {
    throw new Error("ACTION_VIDEO_NOT_VIDEO");
  }

  if (!shouldMirror) {
    return input.videoUrl;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(input.videoUrl);

  if (!response.ok) {
    throw new Error(`ACTION_VIDEO_DOWNLOAD_FAILED_${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > maxActionVideoBytes) {
    throw new Error("ACTION_VIDEO_TOO_LARGE");
  }

  const contentType = response.headers.get("content-type");

  if (!isAcceptableActionVideoDownload({ contentType, pathname: parsed?.pathname })) {
    throw new Error("ACTION_VIDEO_NOT_VIDEO");
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.byteLength > maxActionVideoBytes) {
    throw new Error("ACTION_VIDEO_TOO_LARGE");
  }

  const extension = videoExtensionFromPath(parsed?.pathname);
  const storagePath = actionVideoStoragePath({
    petId: input.petId,
    slot: input.slot,
    jobId: input.jobId,
    extension
  });
  const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: videoContentType(extension, response.headers.get("content-type")),
    upsert: true
  });

  if (upload.error) {
    throw upload.error;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

function safeURL(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLikelyActionVideoUrl(value: string) {
  const parsed = safeURL(value);

  return parsed ? hasSupportedVideoExtension(parsed.pathname) : false;
}

function normalizedContentType(contentType: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() || null;
}

function safeStoragePathPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function videoExtensionFromPath(pathname: string | null | undefined) {
  const match = pathname?.match(/\.([a-zA-Z0-9]+)$/);

  return match?.[1] ?? null;
}

function hasSupportedVideoExtension(pathname: string | null | undefined) {
  const extension = videoExtensionFromPath(pathname);
  const normalized = extension?.trim().toLowerCase().replace(/^\./, "") ?? "";

  return supportedVideoExtensions.has(normalized);
}

function normalizeVideoExtension(extension: string | null | undefined) {
  const normalized = extension?.trim().toLowerCase().replace(/^\./, "") ?? "";

  return supportedVideoExtensions.has(normalized) ? normalized : "mp4";
}

function videoContentType(extension: string | null, contentType: string | null) {
  if (contentType?.startsWith("video/")) {
    return contentType;
  }

  switch (normalizeVideoExtension(extension)) {
    case "webm":
      return "video/webm";
    case "mov":
    case "m4v":
    case "mp4":
    default:
      return "video/mp4";
  }
}
