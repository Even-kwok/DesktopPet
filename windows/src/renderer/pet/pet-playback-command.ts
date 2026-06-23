export type PetPlaybackMode = "loop" | "playOnce";

export type PetPlaybackLoadCommand = {
  petIndex: number;
  videoPath: string;
  mode: PetPlaybackMode;
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
  return normalizedPath.startsWith("/")
    ? `file://${encodeURI(normalizedPath)}`
    : `file:///${encodeURI(normalizedPath)}`;
}
