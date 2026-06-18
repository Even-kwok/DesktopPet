import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { listAdminMaterialLibraryConfigs } from "@/lib/server/material-library-store";
import { getBackendStatus } from "@/lib/supabase/server";
import { materialGroups } from "@/lib/material-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  return NextResponse.json({
    source: getBackendStatus().mode,
    groups: materialGroups,
    materials: await listAdminMaterialLibraryConfigs()
  });
}
