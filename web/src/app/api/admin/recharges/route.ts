import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import {
  listAdminRechargeRecords,
  recordAdminRecharge
} from "@/lib/server/referral-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rechargeSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  userEmail: z.string().trim().email().optional(),
  amountCents: z.number().int().min(0),
  creditsGranted: z.number().int().min(0),
  status: z.enum(["pending", "paid", "failed", "refunded"]),
  note: z.string().trim().max(160).optional()
}).refine((value) => value.userId || value.userEmail, {
  message: "USER_NOT_FOUND"
});

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  return NextResponse.json({ rechargeRecords: await listAdminRechargeRecords() });
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
  const parsed = rechargeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_RECHARGE_RECORD", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await recordAdminRecharge(parsed.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECHARGE_RECORD_FAILED";
    const status = message === "USER_NOT_FOUND" ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
