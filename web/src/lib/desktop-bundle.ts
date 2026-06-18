import type { BackendMode, CurrentUser, DesktopPetBundle, Pet, PetAsset } from "@/lib/types";

export const desktopPetBundleVersion = 1;
export const desktopPetBundleStoragePath =
  process.env.DESKTOP_PET_BUNDLE_PATH || "desktop/latest.json";

type BuildDesktopPetBundleInput = {
  account?: CurrentUser | null;
  backendMode?: BackendMode;
  generatedAt?: string;
  pets: Pet[];
  assets: PetAsset[];
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
  hungry_meow: "饿了嗷嗷叫",
  drag_loop: "拖拽循环（备用）"
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
      const materials = input.assets
        .filter(
          (asset) =>
            asset.petId === pet.id &&
            asset.status === "ready" &&
            typeof asset.videoUrl === "string" &&
            asset.videoUrl.length > 0
        )
        .map((asset) => {
          return {
            slot: asset.slot,
            name: materialNameBySlot[asset.slot] ?? asset.slot,
            videoUrl: asset.videoUrl as string,
            status: "ready" as const
          };
        });

      return {
        id: pet.id,
        petNumber: pet.petNumber,
        ownerUserId: pet.ownerUserId,
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

function displayStateForPet(pet: Pet): DesktopPetBundle["pets"][number]["displayState"] {
  if (pet.locationStatus === "away" || pet.ownership === "away" || pet.host === "friend") {
    return "unavailable";
  }

  return "active";
}
