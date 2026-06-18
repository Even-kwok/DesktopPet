import { nextPetNumber } from "@/lib/account-data-state";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const initialCreditBalance = 10120;

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
        balance: initialCreditBalance,
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

  await supabase
    .from("pets")
    .insert({
      pet_number: nextPetNumber(petNumbers.map((pet) => ({ petNumber: pet.pet_number }))),
      owner_user_id: input.userId,
      current_host_user_id: input.userId,
      name: "猫咪 1",
      species: "cat",
      location_status: "at_owner_desktop",
      updated_at: now
    })
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
