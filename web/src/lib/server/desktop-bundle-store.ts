import { buildDesktopPetBundle, desktopPetBundleStoragePath } from "@/lib/desktop-bundle";
import { petAssets, pets } from "@/lib/mock-data";
import { getBackendStatus, getStorageBuckets, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DesktopPetBundle, DesktopPetBundlePublishResponse } from "@/lib/types";

function emptyDesktopPetBundle(): DesktopPetBundle {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    pets: []
  };
}

export async function loadDesktopPetBundle(): Promise<DesktopPetBundle> {
  const backend = getBackendStatus();

  if (backend.mode === "mock") {
    return buildDesktopPetBundle({ pets, assets: petAssets });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return emptyDesktopPetBundle();
  }

  const { data, error } = await supabase.storage
    .from(getStorageBuckets().assetBundles)
    .download(desktopPetBundleStoragePath);

  if (error) {
    return emptyDesktopPetBundle();
  }

  return JSON.parse(await data.text()) as DesktopPetBundle;
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
