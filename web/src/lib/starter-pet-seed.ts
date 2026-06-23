import { starterPetAssetBundleUrl } from "./starter-pet.ts";

export type StarterPetAssetSeed = {
  slot: string;
  videoUrl: string;
};

export type StarterPetSeed = {
  name: string;
  imageUrl: string | null;
  assets: StarterPetAssetSeed[];
  assetBundleUrl: string;
};

export type StarterPetTemplateSeed = {
  name?: string | null;
  imageUrl?: string | null;
  assets: StarterPetAssetSeed[];
};

const defaultStarterPetTemplateId = "00000000-0000-4000-8000-000000000201";

const starterPetAssetEnvNames: Record<string, string[]> = {
  idle_loop: ["STARTER_CAT_IDLE_LOOP_VIDEO_URL"],
  sleep_loop: ["STARTER_CAT_SLEEP_LOOP_VIDEO_URL"],
  catch_bug: ["STARTER_CAT_CATCH_BUG_VIDEO_URL"],
  click_react: ["STARTER_CAT_CLICK_REACT_VIDEO_URL"]
};

export function getStarterPetSeed(): StarterPetSeed {
  const assetUrls = starterAssetUrlsFromJson();

  return {
    name: readEnv("STARTER_CAT_NAME") ?? "体验猫",
    imageUrl:
      readEnv("STARTER_CAT_IMAGE_URL") ??
      readEnv("NEXT_PUBLIC_STARTER_CAT_IMAGE_URL") ??
      null,
    assets: Object.entries(starterPetAssetEnvNames)
      .map(([slot, envNames]) => ({
        slot,
        videoUrl: assetUrls[slot] ?? firstEnv(envNames)
      }))
      .filter((asset): asset is StarterPetAssetSeed => Boolean(asset.videoUrl)),
    assetBundleUrl: starterPetAssetBundleUrl
  };
}

export function starterPetTemplateId() {
  return readEnv("STARTER_CAT_TEMPLATE_PET_ID") || defaultStarterPetTemplateId;
}

export function starterPetSeedFromTemplate(
  template: StarterPetTemplateSeed | null,
  fallback: StarterPetSeed = getStarterPetSeed()
): StarterPetSeed {
  if (!template) {
    return fallback;
  }

  const imageUrl = template.imageUrl?.trim() || fallback.imageUrl;
  const assets = template.assets.length > 0 ? template.assets : fallback.assets;

  return {
    ...fallback,
    imageUrl,
    assets
  };
}

function starterAssetUrlsFromJson() {
  const raw = readEnv("STARTER_CAT_ASSET_URLS_JSON");

  if (!raw) {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .map(([slot, value]) => [slot, value.trim()])
        .filter(([, value]) => value.length > 0)
    );
  } catch {
    return {};
  }
}

function firstEnv(names: string[]) {
  for (const name of names) {
    const value = readEnv(name);

    if (value) {
      return value;
    }
  }

  return null;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : null;
}
