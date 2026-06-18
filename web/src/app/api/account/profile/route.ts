import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAccountProfile } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(30)
});

export async function PATCH(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_PROFILE_UPDATE",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      user: await updateAccountProfile({
        account: auth.user,
        name: parsed.data.name
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_UPDATE_FAILED";

    return NextResponse.json(
      {
        error:
          message === "DISPLAY_NAME_REQUIRED" || message === "USER_NOT_FOUND"
            ? message
            : "PROFILE_UPDATE_FAILED",
        details: message
      },
      { status: message === "USER_NOT_FOUND" ? 404 : 500 }
    );
  }
}
