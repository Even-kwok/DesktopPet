import {
  buildMaterialLibraryConfigs,
  createAdminMaterialLibraryConfig,
  createMaterialLibraryConfig,
  deleteMaterialLibraryConfig,
  normalizeMaterialCode,
  toPublicMaterialSlot,
  updateMaterialLibraryConfig,
  type MaterialLibraryConfig,
  type MaterialLibraryCreate,
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

export class MaterialLibraryMutationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "MaterialLibraryMutationError";
  }
}

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

export async function createAdminMaterialConfig(input: MaterialLibraryCreate) {
  const backend = getBackendStatus();

  if (backend.mode === "supabase") {
    const created = await createSupabaseMaterialConfig(input);

    if (created) {
      return created;
    }
  }

  const configs = getMockMaterialLibraryConfigs();
  const created = buildAdminMaterialConfig(input);

  if (configs.some((config) => config.code === created.code)) {
    throw new MaterialLibraryMutationError("MATERIAL_CONFIG_ALREADY_EXISTS", 409);
  }

  mockMaterialLibraryConfigs = [...configs, created];

  return created;
}

export async function deleteAdminMaterialConfig(code: string) {
  const backend = getBackendStatus();

  if (backend.mode === "supabase") {
    const deleted = await deleteSupabaseMaterialConfig(code);

    if (deleted) {
      return deleted;
    }
  }

  const deleted = deleteMaterialLibraryConfig(getMockMaterialLibraryConfigs(), code);

  if (!deleted) {
    return null;
  }

  mockMaterialLibraryConfigs = deleted.configs;

  return { deletedCode: deleted.deleted.code };
}

function getMockMaterialLibraryConfigs() {
  if (!mockMaterialLibraryConfigs) {
    mockMaterialLibraryConfigs = buildMaterialLibraryConfigs(materialSlots, materialGroups);
  }

  return mockMaterialLibraryConfigs;
}

async function createSupabaseMaterialConfig(input: MaterialLibraryCreate) {
  const supabase = getSupabaseAdminClient();
  const configs = await listAdminMaterialLibraryConfigs();
  const created = buildAdminMaterialConfig(input);

  if (!supabase) {
    return null;
  }

  if (configs.some((config) => config.code === created.code)) {
    throw new MaterialLibraryMutationError("MATERIAL_CONFIG_ALREADY_EXISTS", 409);
  }

  const { data, error } = await supabase
    .from("material_slot_definitions")
    .insert({
      slot: created.code,
      name: created.name,
      group_id: created.group.id,
      trigger_label: created.trigger.label,
      trigger_is_editable: false,
      duration_seconds: created.durationSeconds,
      credit_rate_per_second: created.creditsPerSecond,
      prompt_template: created.promptContent,
      generation_settings: created.generationSettings,
      is_enabled: created.enabled,
      sort_order: configs.length,
      updated_at: created.updatedAt
    })
    .select(
      "slot,name,group_id,trigger_label,duration_seconds,credit_rate_per_second,prompt_template,generation_settings,is_enabled,updated_at"
    )
    .single();

  if (error) {
    throw new MaterialLibraryMutationError(error.message, 500);
  }

  return data ? materialConfigFromRow(data as MaterialSlotDefinitionRow) : null;
}

function buildAdminMaterialConfig(input: MaterialLibraryCreate) {
  try {
    return createAdminMaterialLibraryConfig(input, materialGroups);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVALID_MATERIAL_")) {
      throw new MaterialLibraryMutationError(error.message, 400);
    }

    throw error;
  }
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

async function deleteSupabaseMaterialConfig(code: string) {
  const supabase = getSupabaseAdminClient();
  const normalizedCode = normalizeMaterialCode(code);

  if (!supabase || !normalizedCode) {
    return null;
  }

  const current = await getAdminMaterialConfig(normalizedCode);

  if (!current) {
    return null;
  }

  const { count, error: countError } = await supabase
    .from("pet_assets")
    .select("id", { count: "exact", head: true })
    .eq("slot", normalizedCode);

  if (countError) {
    throw new MaterialLibraryMutationError(countError.message, 500);
  }

  if ((count ?? 0) > 0) {
    throw new MaterialLibraryMutationError("MATERIAL_CONFIG_IN_USE", 409);
  }

  const { error } = await supabase
    .from("material_slot_definitions")
    .delete()
    .eq("slot", normalizedCode);

  if (error) {
    throw new MaterialLibraryMutationError(error.message, 500);
  }

  return { deletedCode: normalizedCode };
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
