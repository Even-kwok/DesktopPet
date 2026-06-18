import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccountPet, updateAccountPetName } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const deleteSchema = z.object({
  confirmation: z.literal("永久删除")
});

const updatePetSchema = z.object({
  name: z.string().trim().min(1).max(30)
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ petId: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_PET_UPDATE_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { petId } = await context.params;

  try {
    return NextResponse.json({
      pet: await updateAccountPetName({
        account: auth.user,
        petId,
        name: parsed.data.name
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPDATE_PET_FAILED";

    return NextResponse.json(
      {
        error:
          message === "PET_NOT_FOUND" || message === "PET_NAME_REQUIRED"
            ? message
            : "UPDATE_PET_FAILED",
        details: message === "PET_NOT_FOUND" ? "没有找到可修改的猫咪。" : message
      },
      { status: message === "PET_NOT_FOUND" ? 404 : 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ petId: string }> }
) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "DELETE_CONFIRMATION_REQUIRED",
        details: "请输入「永久删除」确认删除猫咪和它的素材。"
      },
      { status: 400 }
    );
  }

  const { petId } = await context.params;

  try {
    return NextResponse.json(await deleteAccountPet(auth.user, petId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "DELETE_PET_FAILED";

    return NextResponse.json(
      {
        error: message === "PET_NOT_FOUND" ? "PET_NOT_FOUND" : "DELETE_PET_FAILED",
        details: message === "PET_NOT_FOUND" ? "没有找到可删除的猫咪。" : message
      },
      { status: message === "PET_NOT_FOUND" ? 404 : 500 }
    );
  }
}
