import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const disabledResponse = {
  error: "FRIENDS_DISABLED",
  details: "好友功能暂时关闭。"
};

export async function GET() {
  return NextResponse.json(disabledResponse, { status: 410 });
}

export async function POST() {
  return NextResponse.json(disabledResponse, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(disabledResponse, { status: 410 });
}
