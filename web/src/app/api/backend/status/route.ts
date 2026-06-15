import { NextResponse } from "next/server";
import { getBackendStatus } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export function GET() {
  return NextResponse.json(getBackendStatus());
}
