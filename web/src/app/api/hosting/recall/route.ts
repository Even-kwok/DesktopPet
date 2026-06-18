import { NextResponse } from "next/server";
import { z } from "zod";
import { recallAccountPet } from "@/lib/server/account-data-store";
import { getRequestAccount } from "@/lib/server/request-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const requestSchema = z.object({
  petId: z.string().min(1)
});

export async function POST(request: Request) {
  const account = await getRequestAccount(request);

  if (!account) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await recallAccountPet({
      account,
      petId: parsed.data.petId
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECALL_FAILED";

    return NextResponse.json(
      {
        error: message === "PET_NOT_FOUND" ? "PET_NOT_FOUND" : "RECALL_FAILED",
        details: message === "PET_NOT_FOUND" ? "没有找到可召回的猫咪。" : message
      },
      { status: message === "PET_NOT_FOUND" ? 404 : 500 }
    );
  }
}
