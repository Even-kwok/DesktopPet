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

export type DesktopFriendCard = {
  id: string;
  name: string;
  status: string;
  hostedPets: number;
};

export type DesktopHostingRequestResponse = {
  requestId: string;
  status: string;
  petId: string;
  toUserId: string;
};

export type DesktopRecallResponse = {
  petId: string;
  status: string;
};

export type DesktopPetSyncSummary = {
  petCount: number;
  materialCount: number;
};

export class DesktopPetSyncError extends Error {
  readonly code: "invalidResponse" | "loginFailed" | "sessionExpired" | "emptyBundle" | "missingIdleLoop";

  constructor(
    code: "invalidResponse" | "loginFailed" | "sessionExpired" | "emptyBundle" | "missingIdleLoop",
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

  static sessionExpired() {
    return new DesktopPetSyncError("sessionExpired", "登录已过期，请重新登录。");
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

  constructor(baseURL = "https://web-guoyaowens-projects.vercel.app", fetchImplementation: typeof fetch = fetch) {
    this.#baseURL = baseURL.replace(/\/+$/, "");
    this.#fetch = fetchImplementation;
  }

  login(email: string, password: string) {
    return this.#sendJSON<DesktopLoginResponse>({
      path: "/api/desktop/auth/login",
      method: "POST",
      body: { email, password },
      unauthorizedError: DesktopPetSyncError.loginFailed()
    });
  }

  fetchBundle(accessToken?: string) {
    return this.#sendJSON<DesktopPetBundle>({
      path: "/api/desktop/pets",
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });
  }

  async fetchFriends(accessToken: string) {
    const response = await this.#sendJSON<{ friends: DesktopFriendCard[] }>({
      path: "/api/friends",
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });
    return response.friends;
  }

  async addFriend(email: string, accessToken: string) {
    const response = await this.#sendJSON<{ friend: DesktopFriendCard }>({
      path: "/api/friends",
      method: "POST",
      body: { email },
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });
    return response.friend;
  }

  removeFriend(friendId: string, accessToken: string) {
    return this.#sendJSON<{ deletedFriendId: string }>({
      path: "/api/friends",
      method: "DELETE",
      body: { friendId },
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });
  }

  requestHosting(petId: string, toUserId: string, accessToken: string) {
    return this.#sendJSON<DesktopHostingRequestResponse>({
      path: "/api/hosting/requests",
      method: "POST",
      body: { petId, toUserId },
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });
  }

  recallPet(petId: string, accessToken: string) {
    return this.#sendJSON<DesktopRecallResponse>({
      path: "/api/hosting/recall",
      method: "POST",
      body: { petId },
      accessToken,
      unauthorizedError: DesktopPetSyncError.sessionExpired()
    });
  }

  async #sendJSON<T>(input: {
    path: string;
    method?: string;
    body?: Record<string, string>;
    accessToken?: string;
    unauthorizedError: DesktopPetSyncError;
  }) {
    const headers: Record<string, string> = {};

    if (input.body) {
      headers["content-type"] = "application/json";
    }

    if (input.accessToken) {
      headers.authorization = `Bearer ${input.accessToken}`;
    }

    const response = await this.#fetch(`${this.#baseURL}${input.path}`, {
      method: input.method ?? "GET",
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw input.unauthorizedError;
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

export function displayablePets(bundle: DesktopPetBundle) {
  return bundle.pets.filter((pet) => {
    const displayState = pet.displayState ?? "active";
    return displayState !== "unavailable" && displayState !== "hidden" && hasReadyIdleLoop(pet);
  });
}

export function syncedPetCardsFromBundle(bundle: DesktopPetBundle): DesktopSyncedPetCard[] {
  return bundle.pets.map((pet, index) => ({
    id: pet.id,
    petNumber: pet.petNumber ?? `P${index + 1}`,
    name: pet.name,
    ownership: pet.ownership ?? "owned",
    displayState: pet.displayState ?? "active",
    avatarUrl: pet.avatarUrl,
    materialCount: pet.materials.filter((material) => material.status === "ready").length
  }));
}

export function readyDesktopMaterials(pet: DesktopPetBundlePet) {
  return pet.materials.filter((material) => material.status === "ready" && material.slot !== "drag_loop");
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

export function safeRemoteMaterialPathComponent(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "pet";
}
