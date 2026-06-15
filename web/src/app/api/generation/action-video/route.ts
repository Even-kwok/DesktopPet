import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultVideoGenerationSettings } from "@/lib/generation-settings";
import { materialSlots } from "@/lib/material-slots";
import { createJimengVideoJob } from "@/lib/server/jimeng";
import { createMockGenerationJob } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const slotIds = new Set(materialSlots.map((slot) => slot.id));

const settingsSchema = z.object({
  durationSeconds: z.number().int().min(4).max(15),
  ratio: z.enum(["adaptive", "1:1", "16:9", "9:16", "4:3", "3:4"]),
  resolution: z.enum(["480p", "720p", "1080p"]),
  framesPerSecond: z.union([z.literal(24), z.literal(30)]),
  cameraFixed: z.boolean(),
  watermark: z.boolean(),
  generateAudio: z.boolean(),
  returnLastFrame: z.boolean()
});

const requestSchema = z.object({
  petId: z.string().min(1),
  slot: z.string().refine((value) => slotIds.has(value), "Unknown material slot"),
  sourceImageUrl: z.string().url().optional(),
  lastImageUrl: z.string().url().optional(),
  settings: settingsSchema.optional()
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
  const cost = slot?.cost ?? 10;

  if (parsed.data.sourceImageUrl) {
    try {
      const providerJob = await createJimengVideoJob({
        petId: parsed.data.petId,
        slot: parsed.data.slot,
        sourceImageUrl: parsed.data.sourceImageUrl,
        lastImageUrl: parsed.data.lastImageUrl ?? parsed.data.sourceImageUrl,
        settings: parsed.data.settings ?? defaultVideoGenerationSettings,
        cost
      });

      if (providerJob) {
        return NextResponse.json(providerJob);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Provider request failed.";

      return NextResponse.json(
        {
          error: "JIMENG_VIDEO_GENERATION_FAILED",
          details: message
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    createMockGenerationJob({
      type: "action_video",
      petId: parsed.data.petId,
      slot: parsed.data.slot,
      cost
    })
  );
}
