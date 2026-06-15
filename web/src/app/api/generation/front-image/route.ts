import { NextResponse } from "next/server";
import { z } from "zod";
import { createMockGenerationJob } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const requestSchema = z.object({
  petId: z.string().min(1),
  sourceImageUrl: z.string().url()
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

  return NextResponse.json(
    createMockGenerationJob({
      type: "front_image",
      petId: parsed.data.petId,
      cost: 10
    })
  );
}
