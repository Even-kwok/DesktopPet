import { NextResponse } from "next/server";
import { z } from "zod";
import { createDesktopLoginSession } from "@/lib/server/desktop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_LOGIN_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const session = await createDesktopLoginSession({
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password
    });

    if (!session) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        error: "DESKTOP_LOGIN_FAILED",
        details: error instanceof Error ? error.message : "Desktop login failed."
      },
      { status: 500 }
    );
  }
}
