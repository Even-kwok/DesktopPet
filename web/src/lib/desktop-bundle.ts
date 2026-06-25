import type { BackendMode, CurrentUser, DesktopPetBundle, Pet, PetAsset } from "@/lib/types";
import { isDeprecatedMaterialSlotId } from "./material-slots.ts";
import {
  isLegacyDefaultStarterPetAssetUrl,
  type StarterPetAssetSeed
} from "./starter-pet.ts";

export const desktopPetBundleVersion = 1;
export const desktopPetBundleStoragePath =
  process.env.DESKTOP_PET_BUNDLE_PATH || "desktop/latest.json";

type BuildDesktopPetBundleInput = {
  account?: CurrentUser | null;
  backendMode?: BackendMode;
  generatedAt?: string;
  pets: Pet[];
  assets: PetAsset[];
  starterPetAssets?: StarterPetAssetSeed[];
};

const materialNameBySlot: Record<string, string> = {
  idle_loop: "待机循环",
  sleep_loop: "睡觉",
  catch_bug: "鼠标经过抓虫子",
  catch_bug_up: "双手抓上方虫子",
  click_react: "点击反应",
  head_rub_left: "左边头蹭蹭",
  head_rub_right: "右边头蹭蹭",
  angry_swipe_left: "向左看生气挥一下爪子",
  angry_swipe_right: "向右看生气挥一下爪子",
  yawn: "打哈欠",
  lick_belly: "舔肚子的毛",
  lick_back: "舔背部的毛",
  stretch: "伸懒腰",
  happy: "开心",
  disgusted: "嫌弃",
  clingy: "粘人",
  aloof: "高冷",
  belly_up: "躺下翻肚皮",
  full_wash_face: "吃饱满足洗脸",
  hungry_meow: "饿了嗷嗷叫"
};

export function buildDesktopPetBundle(input: BuildDesktopPetBundleInput): DesktopPetBundle {
  const visiblePets = input.account
    ? input.pets.filter(
        (pet) =>
          pet.ownerUserId === input.account?.id ||
          pet.currentHostUserId === input.account?.id
      )
    : input.pets;

  return {
    version: desktopPetBundleVersion,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    account: input.account
      ? {
          id: input.account.id,
          name: input.account.name,
          email: input.account.email,
          credits: input.account.credits
        }
      : null,
    sync: {
      mode: input.backendMode ?? "mock",
      source: input.account ? "account" : "mock",
      recommendedPollSeconds: 300
    },
    pets: visiblePets.map((pet) => {
      const materials = desktopMaterialsForPet({
        pet,
        assets: input.assets,
        starterPetAssets: input.starterPetAssets ?? []
      });

      return {
        id: pet.id,
        petNumber: pet.petNumber,
        ownerUserId: pet.ownerUserId,
        ownerName: pet.ownerName ?? null,
        ownerEmail: pet.ownerEmail ?? null,
        currentHostUserId: pet.currentHostUserId ?? null,
        name: pet.name,
        type: pet.type,
        ownership: pet.ownership,
        displayState: displayStateForPet(pet),
        avatarUrl: pet.frontImageUrl ?? pet.sourceImageUrl ?? null,
        materials
      };
    })
  };
}

function desktopMaterialsForPet(input: {
  pet: Pet;
  assets: PetAsset[];
  starterPetAssets: StarterPetAssetSeed[];
}) {
  const materials = new Map<string, DesktopPetBundle["pets"][number]["materials"][number]>();
  const starterAssetsBySlot = new Map(
    input.starterPetAssets
      .filter((asset) => !isDeprecatedMaterialSlotId(asset.slot) && asset.videoUrl.trim().length > 0)
      .map((asset) => [asset.slot, asset.videoUrl.trim()])
  );

  for (const asset of input.assets) {
    if (
      asset.petId !== input.pet.id ||
      asset.status !== "ready" ||
      typeof asset.videoUrl !== "string" ||
      asset.videoUrl.trim().length === 0 ||
      isDeprecatedMaterialSlotId(asset.slot)
    ) {
      continue;
    }

    const videoUrl = desktopVideoUrlForAsset({
      pet: input.pet,
      slot: asset.slot,
      videoUrl: asset.videoUrl,
      starterAssetsBySlot
    });

    if (!videoUrl) {
      continue;
    }

    materials.set(asset.slot, desktopMaterial(asset.slot, videoUrl));
  }

  if (input.pet.isReadonly) {
    for (const [slot, videoUrl] of starterAssetsBySlot) {
      if (!materials.has(slot)) {
        materials.set(slot, desktopMaterial(slot, videoUrl));
      }
    }
  }

  return [...materials.values()];
}

function desktopVideoUrlForAsset(input: {
  pet: Pet;
  slot: string;
  videoUrl: string;
  starterAssetsBySlot: Map<string, string>;
}) {
  const videoUrl = input.videoUrl.trim();

  if (!input.pet.isReadonly || !isLegacyDefaultStarterPetAssetUrl(videoUrl)) {
    return videoUrl;
  }

  return input.starterAssetsBySlot.get(input.slot) ?? null;
}

function desktopMaterial(slot: string, videoUrl: string): DesktopPetBundle["pets"][number]["materials"][number] {
  return {
    slot,
    name: materialNameBySlot[slot] ?? slot,
    videoUrl,
    status: "ready"
  };
}

function displayStateForPet(pet: Pet): DesktopPetBundle["pets"][number]["displayState"] {
  if (pet.locationStatus === "away" || pet.ownership === "away" || pet.host === "friend") {
    return "unavailable";
  }

  return "active";
}
