type ProviderPayload = Record<string, unknown>;

function valueAtPath(payload: ProviderPayload, path: string) {
  const value = path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, payload);

  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractSeedanceResultUrl(payload: ProviderPayload) {
  for (const path of [
    "content.video_url",
    "content.result_url",
    "content.url",
    "data.content.video_url",
    "data.content.result_url",
    "data.content.url",
    "video_url",
    "result_url",
    "data.video_url",
    "data.result_url",
    "data.output.video_url",
    "data.output.result_url",
    "data.output.url"
  ]) {
    const value = valueAtPath(payload, path);

    if (value) {
      return value;
    }
  }

  return null;
}

