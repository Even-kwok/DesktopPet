import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import {
  createAdminMaterialConfig,
  listAdminMaterialLibraryConfigs,
  MaterialLibraryMutationError
} from "@/lib/server/material-library-store";
import { getBackendStatus } from "@/lib/supabase/server";
import { materialGroups } from "@/lib/material-slots";
import { materialUnlockTiers } from "@/lib/material-library-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const materialGroupIds = materialGroups.map((group) => group.id) as [
  (typeof materialGroups)[number]["id"],
  ...(typeof materialGroups)[number]["id"][]
];
const materialTierIds = materialUnlockTiers.map((tier) => tier.id) as [
  (typeof materialUnlockTiers)[number]["id"],
  ...(typeof materialUnlockTiers)[number]["id"][]
];

const createSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  groupId: z.enum(materialGroupIds),
  unlockTier: z.enum(materialTierIds).optional(),
  durationSeconds: z.number().int().min(4).max(15),
  creditsPerSecond: z.number().min(0).max(100),
  promptContent: z.string().trim().min(1).max(4000),
  enabled: z.boolean().optional()
});

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

export async function POST(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_MATERIAL_CONFIG_CREATE",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await createAdminMaterialConfig(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof MaterialLibraryMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "MATERIAL_CONFIG_CREATE_FAILED" }, { status: 500 });
  }
}
