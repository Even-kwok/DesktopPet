import {
  defaultVideoGenerationSettings,
  normalizeVideoGenerationSettings,
  patchVideoGenerationSettings,
  type VideoGenerationSettings
} from "@/lib/generation-settings";
import { getBackendStatus, getSupabaseAdminClient } from "@/lib/supabase/server";

const videoGenerationSettingsKey = "video_generation_settings";

type AppSettingsRow = {
  key: string;
  value: Record<string, unknown> | null;
  updated_at: string;
};

let mockVideoGenerationSettings = defaultVideoGenerationSettings;

export async function loadVideoGenerationSettings(): Promise<VideoGenerationSettings> {
  const backend = getBackendStatus();
  const supabase = getSupabaseAdminClient();

  if (backend.mode === "supabase" && supabase) {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value,updated_at")
      .eq("key", videoGenerationSettingsKey)
      .maybeSingle();

    if (!error && data) {
      return normalizeVideoGenerationSettings((data as AppSettingsRow).value);
    }
  }

  return mockVideoGenerationSettings;
}

export async function saveVideoGenerationSettings(
  patch: unknown
): Promise<VideoGenerationSettings> {
  const current = await loadVideoGenerationSettings();
  const settings = patchVideoGenerationSettings(current, patch);
  const backend = getBackendStatus();
  const supabase = getSupabaseAdminClient();

  if (backend.mode === "supabase" && supabase) {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: videoGenerationSettingsKey,
          value: settings,
          updated_at: new Date().toISOString()
        },
        { onConflict: "key" }
      )
      .select("key,value,updated_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to save generation settings.");
    }

    return normalizeVideoGenerationSettings((data as AppSettingsRow).value);
  }

  mockVideoGenerationSettings = settings;
  return settings;
}
