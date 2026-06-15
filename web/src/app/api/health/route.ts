import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "desktop-pet-web",
    regionHint: "sin1",
    timestamp: new Date().toISOString()
  });
}
