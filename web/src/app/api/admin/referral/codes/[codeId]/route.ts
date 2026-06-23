import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { updateAdminReferralCodeStatus } from "@/lib/server/referral-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.enum(["active", "disabled"])
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "REFERRAL_CODE_INVALID", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { codeId } = await params;

    return NextResponse.json(
      await updateAdminReferralCodeStatus({
        codeId,
        status: parsed.data.status
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "REFERRAL_CODE_UPDATE_FAILED";

    return NextResponse.json({ error: message }, { status: 404 });
  }
}
