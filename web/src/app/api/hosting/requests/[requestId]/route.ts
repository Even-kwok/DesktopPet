import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const disabledResponse = {
  error: "HOSTING_DISABLED",
  details: "相关互动功能暂时关闭。"
};

export async function PATCH() {
  return NextResponse.json(disabledResponse, { status: 410 });
}
