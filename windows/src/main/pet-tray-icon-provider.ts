type CreateThumbnailFromPath = (
  videoPath: string,
  size: { width: number; height: number }
) => Promise<unknown>;

export type PetTrayIconProviderOptions = {
  createThumbnailFromPath: CreateThumbnailFromPath;
  fallbackIcon?: unknown;
  thumbnailSize?: { width: number; height: number };
};

export class PetTrayIconProvider {
  readonly #createThumbnailFromPath: CreateThumbnailFromPath;
  readonly #fallbackIcon: unknown;
  readonly #thumbnailSize: { width: number; height: number };
  readonly #cache = new Map<string, unknown>();
  readonly #failedPaths = new Set<string>();
  readonly #pendingGeneration = new Map<string, number>();
  #generation = 0;

  constructor(options: PetTrayIconProviderOptions) {
    this.#createThumbnailFromPath = options.createThumbnailFromPath;
    this.#fallbackIcon = options.fallbackIcon;
    this.#thumbnailSize = options.thumbnailSize ?? { width: 28, height: 28 };
  }

  iconForVideo(videoPath: string | undefined, onReady?: () => void) {
    if (!videoPath) {
      return this.#fallbackIcon;
    }

    const cachedIcon = this.#cache.get(videoPath);
    if (cachedIcon) {
      return cachedIcon;
    }

    if (this.#failedPaths.has(videoPath) || this.#pendingGeneration.has(videoPath)) {
      return this.#fallbackIcon;
    }

    const generation = this.#generation;
    this.#pendingGeneration.set(videoPath, generation);
    void this.#createThumbnailFromPath(videoPath, this.#thumbnailSize)
      .then((icon) => {
        if (this.#generation !== generation || this.#pendingGeneration.get(videoPath) !== generation) {
          return;
        }

        if (isEmptyIcon(icon)) {
          this.#failedPaths.add(videoPath);
          return;
        }

        this.#cache.set(videoPath, icon);
        onReady?.();
      })
      .catch(() => {
        if (this.#generation === generation) {
          this.#failedPaths.add(videoPath);
        }
      })
      .finally(() => {
        if (this.#pendingGeneration.get(videoPath) === generation) {
          this.#pendingGeneration.delete(videoPath);
        }
      });

    return this.#fallbackIcon;
  }

  invalidate() {
    this.#generation += 1;
    this.#cache.clear();
    this.#failedPaths.clear();
    this.#pendingGeneration.clear();
  }
}

function isEmptyIcon(icon: unknown) {
  return (
    icon !== null &&
    typeof icon === "object" &&
    "isEmpty" in icon &&
    typeof icon.isEmpty === "function" &&
    icon.isEmpty()
  );
}
