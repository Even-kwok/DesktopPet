import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAccountHostingRequest } from "@/lib/server/account-data-store";
import { getRequestAccount } from "@/lib/server/request-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const actionSchema = z.object({
  action: z.enum(["accept", "decline", "return"])
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  const account = await getRequestAccount(request);

  if (!account) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { requestId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);

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
    const hostingRequest = await updateAccountHostingRequest({
      account,
      requestId,
      action: parsed.data.action
    });

    return NextResponse.json({
      request: hostingRequest,
      requestId: hostingRequest.id,
      status: hostingRequest.status,
      petId: hostingRequest.petId,
      fromUserId: hostingRequest.fromUserId,
      toUserId: hostingRequest.toUserId,
      statusCode: hostingRequest.statusCode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HOSTING_REQUEST_UPDATE_FAILED";

    return NextResponse.json(
      {
        error: message === "HOSTING_REQUEST_NOT_FOUND" || message === "PET_NOT_FOUND"
          ? "HOSTING_REQUEST_NOT_FOUND"
          : "HOSTING_REQUEST_UPDATE_FAILED",
        details: message === "HOSTING_REQUEST_NOT_FOUND" || message === "PET_NOT_FOUND"
          ? "没有找到可处理的寄养请求。"
          : message
      },
      { status: message === "HOSTING_REQUEST_NOT_FOUND" || message === "PET_NOT_FOUND" ? 404 : 500 }
    );
  }
}
