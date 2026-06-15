import { NextResponse } from "next/server";
import { z } from "zod";

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

  const statusByAction = {
    accept: "已接收托管",
    decline: "已拒绝",
    return: "已送回主人"
  } satisfies Record<typeof parsed.data.action, string>;

  return NextResponse.json({
    requestId,
    status: statusByAction[parsed.data.action]
  });
}
