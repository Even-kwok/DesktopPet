import { NextResponse } from "next/server";
import { z } from "zod";
import { adjustAdminUserCredits } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const updateSchema = z.object({
  amount: z.number().int().refine((value) => value !== 0, {
    message: "调整数量不能为 0"
  }),
  reason: z.string().trim().min(1).max(160)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const { userId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_CREDIT_ADJUSTMENT",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await adjustAdminUserCredits({
        userId,
        amount: parsed.data.amount,
        reason: parsed.data.reason
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "积分调整失败";

    if (message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    if (
      message === "CREDIT_ADJUSTMENT_AMOUNT_REQUIRED" ||
      message === "CREDIT_ADJUSTMENT_REASON_REQUIRED"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "CREDIT_ADJUSTMENT_FAILED",
        details: message
      },
      { status: 500 }
    );
  }
}

