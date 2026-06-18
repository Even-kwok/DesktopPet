import { NextResponse } from "next/server";
import { z } from "zod";
import { loadAccountDataSnapshot, saveAccountPetAsset } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ petId: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { petId } = await context.params;
  const snapshot = await loadAccountDataSnapshot(auth.user);

  return NextResponse.json({
    petId,
    assets: snapshot.assets.filter((asset) => asset.petId === petId)
  });
}

const saveMaterialSchema = z.object({
  slot: z.string().min(1),
  videoUrl: z.string().url()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ petId: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = saveMaterialSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_MATERIAL_SAVE_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { petId } = await context.params;

  try {
    const asset = await saveAccountPetAsset({
      account: auth.user,
      petId,
      slot: parsed.data.slot,
      videoUrl: parsed.data.videoUrl
    });

    return NextResponse.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAVE_MATERIAL_FAILED";

    return NextResponse.json(
      {
        error: message === "PET_NOT_FOUND" ? "PET_NOT_FOUND" : "SAVE_MATERIAL_FAILED",
        details: message
      },
      { status: message === "PET_NOT_FOUND" ? 404 : 500 }
    );
  }
}
