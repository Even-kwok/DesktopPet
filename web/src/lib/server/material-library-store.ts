import {
  buildMaterialLibraryConfigs,
  createMaterialLibraryConfig,
  toPublicMaterialSlot,
  updateMaterialLibraryConfig,
  type MaterialLibraryConfig,
  type MaterialLibraryUpdate
} from "@/lib/material-library-config";
import { materialGroups, materialSlots, type MaterialGroupId } from "@/lib/material-slots";
import { getBackendStatus, getSupabaseAdminClient } from "@/lib/supabase/server";

type MaterialSlotDefinitionRow = {
  slot: string;
  name: string;
  group_id: string;
  trigger_label: string;
  duration_seconds: number;
  credit_rate_per_second: number;
  prompt_template: string;
  generation_settings: Record<string, unknown> | null;
  is_enabled: boolean;
  updated_at: string;
};

let mockMaterialLibraryConfigs: MaterialLibraryConfig[] | null = null;

export async function listAdminMaterialLibraryConfigs() {
  const supabaseConfigs = await loadSupabaseMaterialLibraryConfigs();

  if (supabaseConfigs) {
    return supabaseConfigs;
  }

  return getMockMaterialLibraryConfigs();
}

export async function listPublicMaterialSlots() {
  const configs = await listAdminMaterialLibraryConfigs();

  return configs.filter((config) => config.enabled).map(toPublicMaterialSlot);
}

export async function getAdminMaterialConfig(code: string) {
  const configs = await listAdminMaterialLibraryConfigs();

  return configs.find((config) => config.code === code) ?? null;
}

export async function getMaterialPrompt(code: string) {
  const config = await getAdminMaterialConfig(code);

  return config?.promptContent ?? null;
}

export async function updateAdminMaterialConfig(code: string, patch: MaterialLibraryUpdate) {
  const backend = getBackendStatus();

  if (backend.mode === "supabase") {
    const updated = await updateSupabaseMaterialConfig(code, patch);

    if (updated) {
      return updated;
    }
  }

  const configs = getMockMaterialLibraryConfigs();
  const index = configs.findIndex((config) => config.code === code);

  if (index < 0) {
    return null;
  }

  const updated = updateMaterialLibraryConfig(configs[index], patch, materialGroups);
  mockMaterialLibraryConfigs = configs.map((config) =>
    config.code === code ? updated : config
  );

  return updated;
}

function getMockMaterialLibraryConfigs() {
  if (!mockMaterialLibraryConfigs) {
    mockMaterialLibraryConfigs = buildMaterialLibraryConfigs(materialSlots, materialGroups);
  }

  return mockMaterialLibraryConfigs;
}

async function loadSupabaseMaterialLibraryConfigs() {
  const backend = getBackendStatus();
  const supabase = getSupabaseAdminClient();

  if (backend.mode !== "supabase" || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("material_slot_definitions")
    .select(
      "slot,name,group_id,trigger_label,duration_seconds,credit_rate_per_second,prompt_template,generation_settings,is_enabled,updated_at"
    )
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return null;
  }

  return data.map((row) => materialConfigFromRow(row as MaterialSlotDefinitionRow));
}

async function updateSupabaseMaterialConfig(code: string, patch: MaterialLibraryUpdate) {
  const supabase = getSupabaseAdminClient();
  const current = await getAdminMaterialConfig(code);

  if (!supabase || !current) {
    return null;
  }

  const durationSeconds = patch.durationSeconds ?? current.durationSeconds;
  const creditsPerSecond = patch.creditsPerSecond ?? current.creditsPerSecond;
  const updated = updateMaterialLibraryConfig(current, patch, materialGroups);
  const { data, error } = await supabase
    .from("material_slot_definitions")
    .update({
      name: updated.name,
      group_id: updated.group.id,
      duration_seconds: durationSeconds,
      credit_rate_per_second: creditsPerSecond,
      prompt_template: updated.promptContent,
      is_enabled: updated.enabled,
      generation_settings: updated.generationSettings,
      updated_at: updated.updatedAt
    })
    .eq("slot", code)
    .select(
      "slot,name,group_id,trigger_label,duration_seconds,credit_rate_per_second,prompt_template,generation_settings,is_enabled,updated_at"
    )
    .single();

  if (error || !data) {
    return null;
  }

  return materialConfigFromRow(data as MaterialSlotDefinitionRow);
}

function materialConfigFromRow(row: MaterialSlotDefinitionRow): MaterialLibraryConfig {
  const seed = materialSlots.find((slot) => slot.id === row.slot);
  const groupId = materialGroups.some((group) => group.id === row.group_id)
    ? (row.group_id as MaterialGroupId)
    : seed?.group ?? "reserved";
  const group = materialGroups.find((item) => item.id === groupId);

  return createMaterialLibraryConfig({
    code: row.slot,
    name: row.name,
    icon: seed?.icon ?? "🐾",
    group: {
      id: groupId,
      name: group?.title ?? groupId,
      description: group?.description ?? ""
    },
    triggerLabel: row.trigger_label,
    durationSeconds: row.duration_seconds,
    creditsPerSecond: row.credit_rate_per_second,
    promptContent: row.prompt_template,
    enabled: row.is_enabled,
    updatedAt: row.updated_at
  });
}
