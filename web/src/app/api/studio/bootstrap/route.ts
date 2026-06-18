import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { getStudioBootstrap } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  return NextResponse.json(await getStudioBootstrap(auth.user));
}
