import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import {
  loadReferralSettings,
  saveReferralSettings
} from "@/lib/server/referral-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  rewardPercent: z.number().int().min(0).max(100).optional(),
  firstRechargeDiscountPercent: z.number().int().min(0).max(100).optional()
});

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  return NextResponse.json(await loadReferralSettings());
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REFERRAL_SETTINGS", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return NextResponse.json(await saveReferralSettings(parsed.data));
}
