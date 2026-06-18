import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAccountHostingRequest,
  loadAccountDataSnapshot
} from "@/lib/server/account-data-store";
import { getRequestAccount } from "@/lib/server/request-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  const account = await getRequestAccount(request);

  if (!account) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const snapshot = await loadAccountDataSnapshot(account);

  return NextResponse.json({
    requests: snapshot.hostingRequests
  });
}

const requestSchema = z.object({
  petId: z.string().min(1),
  toUserId: z.string().min(1)
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
    const hostingRequest = await createAccountHostingRequest({
      account,
      petId: parsed.data.petId,
      toUserId: parsed.data.toUserId
    });

    return NextResponse.json({
      request: hostingRequest,
      requestId: hostingRequest.id,
      status: "pending",
      petId: parsed.data.petId,
      toUserId: parsed.data.toUserId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HOSTING_REQUEST_FAILED";

    return NextResponse.json(
      {
        error: message === "HOSTING_TARGET_NOT_FOUND" ? "HOSTING_TARGET_NOT_FOUND" : "HOSTING_REQUEST_FAILED",
        details: message === "HOSTING_TARGET_NOT_FOUND" ? "没有找到可寄养的宠物或好友。" : message
      },
      { status: message === "HOSTING_TARGET_NOT_FOUND" ? 404 : 500 }
    );
  }
}
