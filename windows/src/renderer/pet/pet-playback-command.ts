export type PetPlaybackMode = "loop" | "playOnce";

export type PetPlaybackLoadCommand = {
  petIndex: number;
  videoPath: string;
  mode: PetPlaybackMode;
};

export type PetCommand =
  | ({
      type: "loadVideo";
    } & PetPlaybackLoadCommand)
  | {
      type: "pause";
    }
  | {
      type: "playDropBounce";
    };

export type PetPlaybackRequest = {
  source: string;
  mode: PetPlaybackMode;
  revision: number;
};

export type PetVisualEffect = "dropBounce";

export type PetVisualEffectRequest = {
  effect: PetVisualEffect;
  revision: number;
};

export function nextPetPlaybackRequest(
  current: PetPlaybackRequest | undefined,
  command: PetPlaybackLoadCommand
): PetPlaybackRequest {
  return {
    source: toVideoSource(command.videoPath),
    mode: command.mode,
    revision: (current?.revision ?? 0) + 1
  };
}

export function petCommandFromUnknown(command: unknown): PetCommand | undefined {
  if (!command || typeof command !== "object") {
    return undefined;
  }

  const record = command as Record<string, unknown>;
  if (record.type === "pause" || record.type === "playDropBounce") {
    return { type: record.type };
  }

  if (
    record.type === "loadVideo" &&
    isValidPetIndex(record.petIndex) &&
    typeof record.videoPath === "string" &&
    isPetPlaybackMode(record.mode)
  ) {
    return {
      type: "loadVideo",
      petIndex: record.petIndex,
      videoPath: record.videoPath,
      mode: record.mode
    };
  }

  return undefined;
}

export function nextPetVisualEffectRequest(
  current: PetVisualEffectRequest | undefined,
  effect: PetVisualEffect
): PetVisualEffectRequest {
  return {
    effect,
    revision: (current?.revision ?? 0) + 1
  };
}

export function toVideoSource(videoPath: string) {
  if (/^(file|https?|blob):/i.test(videoPath)) {
    return videoPath;
  }

  const normalizedPath = videoPath.replace(/\\/g, "/");
  const encodedPath = encodeLocalPath(normalizedPath);
  if (normalizedPath.startsWith("//")) {
    return `file://${encodedPath.replace(/^\/+/, "")}`;
  }

  return normalizedPath.startsWith("/")
    ? `file://${encodedPath}`
    : `file:///${encodedPath}`;
}

function isPetPlaybackMode(value: unknown): value is PetPlaybackMode {
  return value === "loop" || value === "playOnce";
}

function isValidPetIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function encodeLocalPath(filePath: string) {
  return filePath
    .split("/")
    .map((segment) => {
      if (!segment || /^[A-Za-z]:$/.test(segment)) {
        return segment;
      }

      return encodeURIComponent(segment);
    })
    .join("/");
}
