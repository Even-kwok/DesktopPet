import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { updateAdminMaterialConfig } from "@/lib/server/material-library-store";
import { materialGroups } from "@/lib/material-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const materialGroupIds = materialGroups.map((group) => group.id) as [
  (typeof materialGroups)[number]["id"],
  ...(typeof materialGroups)[number]["id"][]
];

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  groupId: z.enum(materialGroupIds).optional(),
  durationSeconds: z.number().int().min(4).max(15).optional(),
  creditsPerSecond: z.number().min(0).max(100).optional(),
  promptContent: z.string().trim().min(1).max(4000).optional(),
  enabled: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const { code } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_MATERIAL_CONFIG_UPDATE",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const updated = await updateAdminMaterialConfig(code, parsed.data);

  if (!updated) {
    return NextResponse.json({ error: "MATERIAL_CONFIG_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
