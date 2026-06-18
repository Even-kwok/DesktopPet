import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccountPet, loadAccountDataSnapshot } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const createPetSchema = z.object({
  name: z.string().trim().min(1).max(30).optional()
});

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const snapshot = await loadAccountDataSnapshot(auth.user);

  return NextResponse.json({
    pets: snapshot.pets
  });
}

export async function POST(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createPetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_PET_CREATE_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const pet = await createAccountPet({
      account: auth.user,
      name: parsed.data.name
    });

    return NextResponse.json({ pet }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "PET_CREATE_FAILED",
        details: error instanceof Error ? error.message : "创建宠物失败。"
      },
      { status: 500 }
    );
  }
}
