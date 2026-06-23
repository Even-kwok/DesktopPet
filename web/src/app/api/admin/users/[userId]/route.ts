import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAdminUser } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const deleteSchema = z.object({
  confirmation: z.literal("DELETE")
});

export async function DELETE(
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

  if (userId === auth.user.id) {
    return NextResponse.json(
      {
        error: "CANNOT_DELETE_SELF",
        details: "不能删除当前登录的管理员账号。"
      },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "DELETE_CONFIRMATION_REQUIRED",
        details: "请输入 DELETE 确认删除用户。"
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await deleteAdminUser(userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "DELETE_USER_FAILED";

    if (message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "DELETE_USER_FAILED",
        details: message
      },
      { status: 500 }
    );
  }
}
