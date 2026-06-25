import { buildDesktopPetBundle, desktopPetBundleStoragePath } from "@/lib/desktop-bundle";
import { loadStarterPetSeedFromTemplate } from "@/lib/server/account-provisioning";
import { loadAccountDataSnapshot } from "@/lib/server/account-data-store";
import { getBackendStatus, getStorageBuckets, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { CurrentUser, DesktopPetBundle, DesktopPetBundlePublishResponse } from "@/lib/types";

function emptyDesktopPetBundle(): DesktopPetBundle {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    pets: []
  };
}

export async function loadDesktopPetBundle(account: CurrentUser): Promise<DesktopPetBundle> {
  const backend = getBackendStatus();
  const [snapshot, starterPetSeed] = await Promise.all([
    loadAccountDataSnapshot(account),
    loadStarterPetSeedFromTemplate()
  ]);

  return buildDesktopPetBundle({
    account: snapshot.user,
    backendMode: backend.mode,
    pets: snapshot.pets,
    assets: snapshot.assets,
    starterPetAssets: starterPetSeed.assets
  });
}

export async function saveDesktopPetBundle(
  bundle: DesktopPetBundle
): Promise<DesktopPetBundlePublishResponse> {
  const backend = getBackendStatus();
  const bucket = getStorageBuckets().assetBundles;

  if (backend.mode === "mock") {
    return {
      mode: "mock",
      bucket,
      storagePath: desktopPetBundleStoragePath,
      bundle
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const upload = await supabase.storage
    .from(bucket)
    .upload(desktopPetBundleStoragePath, Buffer.from(JSON.stringify(bundle, null, 2)), {
      contentType: "application/octet-stream",
      upsert: true
    });

  if (upload.error) {
    throw upload.error;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(bucket).getPublicUrl(desktopPetBundleStoragePath);

  return {
    mode: "supabase",
    bucket,
    storagePath: desktopPetBundleStoragePath,
    publicUrl,
    bundle
  };
}
