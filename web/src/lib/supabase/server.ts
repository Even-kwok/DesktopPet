import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BackendStatus } from "@/lib/types";

let cachedAdminClient: SupabaseClient | null = null;

export function getStorageBuckets() {
  return {
    sourceImages: process.env.SUPABASE_SOURCE_IMAGE_BUCKET || "source-images",
    frontImages: process.env.SUPABASE_FRONT_IMAGE_BUCKET || "front-images",
    actionVideos: process.env.SUPABASE_ACTION_VIDEO_BUCKET || "action-videos",
    assetBundles: process.env.SUPABASE_ASSET_BUNDLE_BUCKET || "asset-bundles"
  };
}

export function getBackendStatus(): BackendStatus {
  const buckets = getStorageBuckets();
  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  const supabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const authConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return {
    mode: supabaseConfigured ? "supabase" : "mock",
    supabaseConfigured,
    authConfigured,
    storageConfigured: supabaseConfigured,
    sourceImageBucket: buckets.sourceImages,
    frontImageBucket: buckets.frontImages,
    actionVideoBucket: buckets.actionVideos,
    missingEnv,
    message: supabaseConfigured
      ? "Supabase server env is configured. Server routes can write to storage and database."
      : "Supabase env is not configured yet. The studio is running in mock mode."
  };
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return cachedAdminClient;
}
