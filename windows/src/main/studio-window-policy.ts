export type StudioRendererLoadInput = {
  currentURL: string;
  studioRendererURL?: string;
  studioRendererFile: string;
};

export type StudioRendererLoadTarget =
  | { type: "url"; value: string }
  | { type: "file"; value: string }
  | { type: "none" };

export function studioRendererLoadTarget(input: StudioRendererLoadInput): StudioRendererLoadTarget {
  if (input.currentURL) {
    return { type: "none" };
  }

  if (input.studioRendererURL) {
    return { type: "url", value: input.studioRendererURL };
  }

  return { type: "file", value: input.studioRendererFile };
}
