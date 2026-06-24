export function hasLoadedRendererURL(currentURL: string) {
  return currentURL !== "" && currentURL !== "about:blank";
}

export function nextRendererShowRevision(currentRevision: number) {
  return currentRevision + 1;
}

export function shouldFinishRendererShow(input: {
  requestRevision: number;
  currentRevision: number;
  isVisible: boolean;
}) {
  return input.isVisible && input.requestRevision === input.currentRevision;
}
