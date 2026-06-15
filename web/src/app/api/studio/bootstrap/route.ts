import { NextResponse } from "next/server";
import { getStudioBootstrap } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  return NextResponse.json(getStudioBootstrap());
}
