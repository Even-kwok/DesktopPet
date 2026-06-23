import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import {
  createAdminReferralCode,
  listAdminReferralCodes
} from "@/lib/server/referral-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createCodeSchema = z.object({
  ownerUserId: z.string().trim().min(1).optional(),
  ownerEmail: z.string().trim().email().optional(),
  code: z.string().trim().min(4).max(32)
}).refine((value) => value.ownerUserId || value.ownerEmail, {
  message: "REFERRAL_OWNER_REQUIRED"
});

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  return NextResponse.json({ codes: await listAdminReferralCodes() });
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
  const parsed = createCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "REFERRAL_CODE_INVALID", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await createAdminReferralCode({
        ...parsed.data,
        createdByUserId: auth.user.id
      }),
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "REFERRAL_CODE_CREATE_FAILED";
    const status = message === "REFERRAL_OWNER_NOT_FOUND" ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
