import { hasLoadedRendererURL, shouldFinishRendererShow } from "./renderer-load-policy.ts";

export type StudioRendererLoadInput = {
  currentURL: string;
  studioRendererURL?: string;
  studioRendererFile: string;
};

export type StudioRendererLoadTarget =
  | { type: "url"; value: string }
  | { type: "file"; value: string }
  | { type: "none" };

export type StudioWindowCommand =
  | {
      type: "selectPet";
      petIndex: number;
    }
  | {
      type: "refresh";
    };

export function studioRendererLoadTarget(input: StudioRendererLoadInput): StudioRendererLoadTarget {
  if (hasLoadedRendererURL(input.currentURL)) {
    return { type: "none" };
  }

  if (input.studioRendererURL) {
    return { type: "url", value: input.studioRendererURL };
  }

  return { type: "file", value: input.studioRendererFile };
}

export function studioCommandFromPetPayload(payload: unknown): StudioWindowCommand | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const petIndex = Number((payload as { petIndex?: unknown }).petIndex);
  if (!Number.isInteger(petIndex) || petIndex < 0) {
    return undefined;
  }

  return { type: "selectPet", petIndex };
}

export function studioCommandForShow(command?: StudioWindowCommand): StudioWindowCommand {
  return command ?? { type: "refresh" };
}

export function studioCommandForExternalStateChange(input: {
  currentURL: string;
  isVisible: boolean;
}): StudioWindowCommand | undefined {
  if (!input.isVisible || !hasLoadedRendererURL(input.currentURL)) {
    return undefined;
  }

  return { type: "refresh" };
}

export function studioCommandDispatchPlan(input: {
  command?: StudioWindowCommand;
  requestRevision: number;
  currentRevision: number;
  isVisible: boolean;
  canSendRendererCommand?: boolean;
}): StudioWindowCommand | undefined {
  if (input.canSendRendererCommand === false) {
    return undefined;
  }

  if (!shouldFinishRendererShow(input)) {
    return undefined;
  }

  return studioCommandForShow(input.command);
}
