import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function POST() {
  return NextResponse.json(
    {
      error: "HOSTING_DISABLED",
      details: "相关互动功能暂时关闭。"
    },
    { status: 410 }
  );
}
