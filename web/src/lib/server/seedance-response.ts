type ProviderPayload = Record<string, unknown>;

const videoExtensions = new Set(["mp4", "m4v", "mov", "webm"]);

function valueAtPath(payload: ProviderPayload, path: string) {
  const value = path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, payload);

  return typeof value === "string" && value.length > 0 ? value : null;
}

function isVideoFileUrl(value: string) {
  let pathname = value;

  try {
    pathname = new URL(value).pathname;
  } catch {
    // Provider fields should be absolute URLs, but keep extension matching tolerant.
  }

  const extension = pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

  return extension ? videoExtensions.has(extension) : false;
}

export function extractSeedanceResultUrl(payload: ProviderPayload) {
  for (const path of [
    "content.video_url",
    "content.result_url",
    "data.content.video_url",
    "data.content.result_url",
    "video_url",
    "result_url",
    "data.video_url",
    "data.result_url",
    "data.output.video_url",
    "data.output.result_url"
  ]) {
    const value = valueAtPath(payload, path);

    if (value) {
      return value;
    }
  }

  for (const path of [
    "content.url",
    "data.content.url",
    "data.output.url"
  ]) {
    const value = valueAtPath(payload, path);

    if (value && isVideoFileUrl(value)) {
      return value;
    }
  }

  return null;
}

export function extractSeedanceLastFrameUrl(payload: ProviderPayload) {
  for (const path of [
    "content.last_frame_url",
    "data.content.last_frame_url",
    "last_frame_url",
    "data.last_frame_url",
    "data.output.last_frame_url"
  ]) {
    const value = valueAtPath(payload, path);

    if (value) {
      return value;
    }
  }

  return null;
}
