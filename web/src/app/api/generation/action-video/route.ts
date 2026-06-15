import { NextResponse } from "next/server";
import { z } from "zod";
import { materialSlots } from "@/lib/material-slots";
import { createMockGenerationJob } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const slotIds = new Set(materialSlots.map((slot) => slot.id));

const requestSchema = z.object({
  petId: z.string().min(1),
  slot: z.string().refine((value) => slotIds.has(value), "Unknown material slot")
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

  const slot = materialSlots.find((item) => item.id === parsed.data.slot);

  return NextResponse.json(
    createMockGenerationJob({
      type: "action_video",
      petId: parsed.data.petId,
      slot: parsed.data.slot,
      cost: slot?.cost ?? 10
    })
  );
}
