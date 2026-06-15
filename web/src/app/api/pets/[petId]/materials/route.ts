import { NextResponse } from "next/server";
import { petAssets } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ petId: string }> }
) {
  const { petId } = await context.params;

  return NextResponse.json({
    petId,
    assets: petAssets.filter((asset) => asset.petId === petId)
  });
}
