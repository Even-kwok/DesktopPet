import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { seedanceVideoModelValues } from "@/lib/generation-settings";
import {
  loadVideoGenerationSettings,
  saveVideoGenerationSettings
} from "@/lib/server/generation-settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const updateSchema = z.object({
  model: z.enum(seedanceVideoModelValues).optional(),
  durationSeconds: z.number().int().min(4).max(15).optional(),
  ratio: z.enum(["adaptive", "1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
  resolution: z.enum(["480p", "720p"]).optional(),
  framesPerSecond: z.literal(24).optional(),
  cameraFixed: z.boolean().optional(),
  watermark: z.boolean().optional(),
  generateAudio: z.boolean().optional(),
  returnLastFrame: z.boolean().optional()
});

export async function GET() {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  return NextResponse.json(await loadVideoGenerationSettings());
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    return NextResponse.json(
      { error: auth.user ? "ADMIN_REQUIRED" : "AUTH_REQUIRED" },
      { status: auth.user ? 403 : 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_GENERATION_SETTINGS_UPDATE",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await saveVideoGenerationSettings(parsed.data));
  } catch (error) {
    return NextResponse.json(
      {
        error: "GENERATION_SETTINGS_SAVE_FAILED",
        details: error instanceof Error ? error.message : "保存失败"
      },
      { status: 500 }
    );
  }
}
