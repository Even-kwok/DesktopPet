import { allPetActionSlots } from "./pet-action-slots.ts";
import type { PetActionSlot } from "./pet-action-slots.ts";
import type { DesktopSyncedPetCard } from "./settings-store.ts";

export type DesktopSyncAccount = {
  id: string;
  name: string;
  email: string;
  credits: number;
};

export type DesktopLoginResponse = {
  mode: string;
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  account: DesktopSyncAccount;
};

export type DesktopPetBundle = {
  version: number;
  generatedAt: string;
  account?: DesktopSyncAccount | null;
  sync?: {
    mode: string;
    source: string;
    recommendedPollSeconds: number;
  };
  pets: readonly DesktopPetBundlePet[];
};

export type DesktopPetBundlePet = {
  id: string;
  petNumber?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  currentHostUserId?: string | null;
  name: string;
  type: string;
  ownership?: string | null;
  displayState?: string | null;
  avatarUrl?: string | null;
  materials: readonly DesktopPetBundleMaterial[];
};

export type DesktopPetBundleMaterial = {
  slot: PetActionSlot;
  name: string;
  videoUrl: string;
  status: string;
};

export type DesktopEventsResponse = {
  events: unknown[];
  cursor?: string | null;
};

export type DesktopPetSyncSummary = {
  petCount: number;
  materialCount: number;
};

export class DesktopPetSyncError extends Error {
  readonly code:
    | "invalidResponse"
    | "loginFailed"
    | "networkFailed"
    | "sessionExpired"
    | "requestRejected"
    | "emptyBundle"
    | "missingIdleLoop";

  constructor(
    code:
      | "invalidResponse"
      | "loginFailed"
      | "networkFailed"
      | "sessionExpired"
      | "requestRejected"
      | "emptyBundle"
      | "missingIdleLoop",
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "DesktopPetSyncError";
  }

  static invalidResponse() {
    return new DesktopPetSyncError("invalidResponse", "桌面同步返回异常。");
  }

  static loginFailed() {
    return new DesktopPetSyncError("loginFailed", "登录失败，请检查账号和密码。");
  }

  static networkFailed() {
    return new DesktopPetSyncError("networkFailed", "连接网页端失败，请检查网络后重试。");
  }

  static sessionExpired() {
    return new DesktopPetSyncError("sessionExpired", "登录已过期，请重新登录。");
  }

  static requestRejected(message: string) {
    return new DesktopPetSyncError("requestRejected", message);
  }

  static emptyBundle() {
    return new DesktopPetSyncError("emptyBundle", "网页端还没有可同步的视频素材。");
  }

  static missingIdleLoop() {
    return new DesktopPetSyncError("missingIdleLoop", "请先在网页端生成「待机循环」素材，再同步到桌面 App。");
  }
}

export class DesktopPetSyncClient {
  readonly #baseURL: string;
  readonly #fetch: typeof fetch;

  constructor(baseURL?: string, fetchImplementation: typeof fetch = fetch) {
    const resolvedBaseURL = baseURL?.trim() || "https://web-guoyaowens-projects.vercel.app";
    this.#baseURL = resolvedBaseURL.replace(/\/+$/, "");
    this.#fetch = fetchImplementation;
  }

  desktopEventStreamURL() {
    return new URL("/api/desktop/events/stream", this.#baseURL);
  }

  async login(email: string, password: string) {
    const response = await this.#sendJSON<unknown>({
      path: "/api/desktop/auth/login",
      method: "POST",
      body: { email, password },
      unauthorizedError: DesktopPetSyncError.loginFailed(),
      clientError: DesktopPetSyncError.invalidResponse()
    });

    if (!isDesktopLoginResponse(response)) {
      throw DesktopPetSyncError.invalidResponse();
    }

    return response;
  }

  async fetchBundle(accessToken?: string) {
    const response = await this.#sendJSON<unknown>({
      path: "/api/desktop/pets",
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });

    if (!isDesktopPetBundle(response)) {
      throw DesktopPetSyncError.invalidResponse();
    }

    return response;
  }

  async #sendJSON<T>(input: {
    path: string;
    method?: string;
    body?: Record<string, string>;
    accessToken?: string;
    unauthorizedError: DesktopPetSyncError;
    clientError?: DesktopPetSyncError;
  }) {
    const headers: Record<string, string> = {};

    if (input.body) {
      headers["content-type"] = "application/json";
    }

    if (input.accessToken) {
      headers.authorization = `Bearer ${input.accessToken}`;
    }

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseURL}${input.path}`, {
        method: input.method ?? "GET",
        headers,
        body: input.body ? JSON.stringify(input.body) : undefined
      });
    } catch {
      throw DesktopPetSyncError.networkFailed();
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw input.unauthorizedError;
      }

      if (response.status >= 400 && response.status < 500 && input.clientError) {
        throw input.clientError;
      }

      if (response.status >= 400 && response.status < 500) {
        throw DesktopPetSyncError.requestRejected(await readableErrorMessage(response));
      }

      throw DesktopPetSyncError.invalidResponse();
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw DesktopPetSyncError.invalidResponse();
    }
  }
}

async function readableErrorMessage(response: Response) {
  try {
    const body = await response.json() as unknown;
    if (isRecord(body)) {
      if (typeof body.details === "string" && body.details.trim()) {
        return body.details.trim();
      }
      if (typeof body.error === "string" && body.error.trim()) {
        return body.error.trim();
      }
    }
  } catch {}

  return "请求被服务器拒绝，请先同步账号状态后重试。";
}

export function displayablePets(bundle: DesktopPetBundle) {
  return bundle.pets.filter((pet) => {
    const displayState = pet.displayState ?? "active";
    return displayState !== "unavailable" && displayState !== "hidden" && hasReadyIdleLoop(pet);
  });
}

export function syncedPetCardsFromBundle(bundle: DesktopPetBundle): DesktopSyncedPetCard[] {
  return bundle.pets.map((pet) => {
    const card: DesktopSyncedPetCard = {
      id: pet.id,
      petNumber: nonEmptyOrDefault(pet.petNumber, pet.id),
      name: pet.name,
      ownership: nonEmptyOrDefault(pet.ownership, "owned"),
      displayState: nonEmptyOrDefault(pet.displayState, "active"),
      avatarUrl: pet.avatarUrl,
      materialCount: pet.materials.filter((material) => !isDeprecatedMaterialSlot(material.slot)).length
    };

    if (pet.ownerName !== undefined && pet.ownerName !== null) {
      card.ownerName = pet.ownerName;
    }
    if (pet.ownerEmail !== undefined && pet.ownerEmail !== null) {
      card.ownerEmail = pet.ownerEmail;
    }

    return card;
  });
}

export function readyDesktopMaterials(pet: DesktopPetBundlePet) {
  return pet.materials.filter((material) => material.status === "ready" && !isDeprecatedMaterialSlot(material.slot));
}

export function localMaterialReplacementDescriptions(
  bundle: DesktopPetBundle,
  restoreVideoPath: (slot: PetActionSlot, petIndex: number) => string | undefined
) {
  const descriptions: string[] = [];

  displayablePets(bundle).forEach((pet, petIndex) => {
    readyDesktopMaterials(pet).forEach((material) => {
      const existingPath = restoreVideoPath(material.slot, petIndex);
      if (!existingPath || isRemoteMaterialCachePath(existingPath)) {
        return;
      }

      descriptions.push(`${pet.name} · ${material.name}`);
    });
  });

  return descriptions;
}

function hasReadyIdleLoop(pet: DesktopPetBundlePet) {
  return pet.materials.some((material) => material.status === "ready" && material.slot === "idle_loop");
}

function isRemoteMaterialCachePath(filePath: string) {
  const parts = filePath.split(/[\\/]/);
  return parts.includes("CatDesktopPet") && parts.includes("RemoteMaterials");
}

function isDeprecatedMaterialSlot(slot: PetActionSlot) {
  return slot === "drag_loop";
}

function nonEmptyOrDefault(value: string | null | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

function isDesktopLoginResponse(value: unknown): value is DesktopLoginResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.mode) &&
    isBearerTokenType(value.tokenType) &&
    isNonEmptyString(value.accessToken) &&
    isNonNegativeInteger(value.expiresIn) &&
    isDesktopSyncAccount(value.account)
  );
}

function isDesktopSyncAccount(value: unknown): value is DesktopSyncAccount {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.email) &&
    isNonNegativeInteger(value.credits)
  );
}

function isDesktopPetBundle(value: unknown): value is DesktopPetBundle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.version) &&
    isNonEmptyString(value.generatedAt) &&
    isOptionalDesktopSyncAccount(value.account) &&
    isOptionalDesktopSyncMetadata(value.sync) &&
    Array.isArray(value.pets) &&
    value.pets.every(isDesktopPetBundlePet)
  );
}

function isDesktopPetBundlePet(value: unknown): value is DesktopPetBundlePet {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isOptionalString(value.petNumber) &&
    isOptionalString(value.ownerUserId) &&
    isOptionalString(value.ownerName) &&
    isOptionalString(value.ownerEmail) &&
    isOptionalString(value.currentHostUserId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.type) &&
    isOptionalString(value.ownership) &&
    isOptionalString(value.displayState) &&
    isOptionalString(value.avatarUrl) &&
    Array.isArray(value.materials) &&
    value.materials.every(isDesktopPetBundleMaterial)
  );
}

function isDesktopPetBundleMaterial(value: unknown): value is DesktopPetBundleMaterial {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPetActionSlot(value.slot) &&
    isNonEmptyString(value.name) &&
    isRemoteUrlString(value.videoUrl) &&
    isNonEmptyString(value.status)
  );
}

function isOptionalDesktopSyncAccount(value: unknown) {
  return value === undefined || value === null || isDesktopSyncAccount(value);
}

function isOptionalDesktopSyncMetadata(value: unknown) {
  if (value === undefined || value === null) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.mode) &&
    isNonEmptyString(value.source) &&
    isNonNegativeInteger(value.recommendedPollSeconds)
  );
}

function isPetActionSlot(value: unknown): value is PetActionSlot {
  return isString(value) && (value === "drag_loop" || allPetActionSlots.some((slot) => slot === value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown) {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown) {
  return isString(value) && value.trim().length > 0;
}

function isBearerTokenType(value: unknown) {
  return isString(value) && value.toLowerCase() === "bearer";
}

function isRemoteUrlString(value: unknown) {
  if (!isString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isOptionalString(value: unknown) {
  return value === undefined || value === null || isString(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown) {
  return isInteger(value) && value >= 0;
}

export function safeRemoteMaterialPathComponent(value: string) {
  const safe = Array.from(value, (character) =>
    isSafeRemoteMaterialPathCharacter(character) ? character : "-"
  ).join("").replace(/^-+|-+$/g, "");
  return safe || "pet";
}

function isSafeRemoteMaterialPathCharacter(character: string) {
  return /^[\p{L}\p{N}_-]$/u.test(character);
}
