import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccountPet } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

const deleteSchema = z.object({
  confirmation: z.literal("永久删除")
});

export type PetRouteContext = {
  params: Promise<{ petId: string }>;
};

export async function handlePetDeleteRequest(request: Request, context: PetRouteContext) {
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
