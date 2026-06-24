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
  canUseRendererTarget?: boolean;
}) {
  return (
    input.canUseRendererTarget !== false &&
    input.isVisible &&
    input.requestRevision === input.currentRevision
  );
}

export async function settleRendererShow(input: {
  load?: Promise<void>;
  finish: () => void;
}) {
  if (!input.load) {
    input.finish();
    return;
  }

  try {
    await input.load;
    input.finish();
  } catch {
    // Renderer load failures leave the app shell alive; a later show can retry.
  }
}

export function canSendRendererCommand(input: {
  hasWindow: boolean;
  isWebContentsDestroyed: boolean;
}) {
  return input.hasWindow && !input.isWebContentsDestroyed;
}
