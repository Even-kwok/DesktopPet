import { nextPetNumber } from "@/lib/account-data-state";
import { initialCreditBalanceFromEnv } from "@/lib/account-credit-config";
import { getStarterPetSeed } from "@/lib/starter-pet-seed";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ProvisionInput = {
  userId: string;
  email: string;
  displayName?: string | null;
};

export async function provisionSupabaseAccount(input: ProvisionInput) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const displayName = cleanDisplayName(input.displayName) ?? input.email.split("@")[0] ?? "DesktopPet 用户";
  const now = new Date().toISOString();

  await supabase
    .from("profiles")
    .upsert(
      {
        id: input.userId,
        email: input.email,
        display_name: displayName,
        account_status: "active"
      },
      { onConflict: "id" }
    )
    .then(unwrapSupabaseResult);

  await supabase
    .from("credit_balances")
    .upsert(
      {
        user_id: input.userId,
        balance: initialCreditBalanceFromEnv(),
        updated_at: now
      },
      { ignoreDuplicates: true, onConflict: "user_id" }
    )
    .then(unwrapSupabaseResult);

  const existingPets = await supabase
    .from("pets")
    .select("id")
    .eq("owner_user_id", input.userId)
    .limit(1)
    .then(unwrapSupabaseData<Array<{ id: string }>>);

  if (existingPets.length > 0) {
    return;
  }

  const petNumbers = await supabase
    .from("pets")
    .select("pet_number")
    .then(unwrapSupabaseData<Array<{ pet_number: string }>>);
  const starterPet = getStarterPetSeed();
  const starterImageUrl = starterPet.imageUrl;

  const insertedPet = await supabase
    .from("pets")
    .insert({
      pet_number: nextPetNumber(petNumbers.map((pet) => ({ petNumber: pet.pet_number }))),
      owner_user_id: input.userId,
      current_host_user_id: input.userId,
      name: starterPet.name,
      species: "cat",
      avatar_url: starterImageUrl,
      source_image_url: starterImageUrl,
      front_image_url: starterImageUrl,
      asset_bundle_url: starterPet.assetBundleUrl,
      location_status: "at_owner_desktop",
      updated_at: now
    })
    .select("id")
    .single()
    .then(unwrapSupabaseData<{ id: string }>);

  if (starterPet.assets.length === 0) {
    return;
  }

  await supabase
    .from("pet_assets")
    .upsert(
      starterPet.assets.map((asset) => ({
        pet_id: insertedPet.id,
        slot: asset.slot,
        status: "ready",
        video_url: asset.videoUrl,
        updated_at: now
      })),
      { onConflict: "pet_id,slot" }
    )
    .then(unwrapSupabaseResult);
}

function cleanDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, 30) : null;
}

function unwrapSupabaseResult(result: { error: unknown }) {
  if (result.error) {
    throw result.error;
  }
}

function unwrapSupabaseData<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) {
    throw result.error;
  }

  return result.data as T;
}
