import { NextResponse } from "next/server";
import { friends } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  return NextResponse.json({
    friends
  });
}
