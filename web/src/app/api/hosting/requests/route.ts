import { NextResponse } from "next/server";
import { z } from "zod";
import { hostingRequests } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  return NextResponse.json({
    requests: hostingRequests
  });
}

const requestSchema = z.object({
  petId: z.string().min(1),
  toUserId: z.string().min(1)
});

export async function POST(request: Request) {
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

  return NextResponse.json({
    requestId: `hosting_${crypto.randomUUID()}`,
    status: "pending",
    petId: parsed.data.petId,
    toUserId: parsed.data.toUserId
  });
}
