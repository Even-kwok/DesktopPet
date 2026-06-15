import { NextResponse } from "next/server";
import { z } from "zod";
import { loadDesktopPetBundle, saveDesktopPetBundle } from "@/lib/server/desktop-bundle-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const materialSchema = z.object({
  slot: z.string().min(1),
  name: z.string().min(1),
  videoUrl: z.string().url(),
  status: z.literal("ready")
});

const petSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["cat", "dog"]),
  avatarUrl: z.string().url().nullable().optional(),
  materials: z.array(materialSchema)
});

const bundleSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().min(1),
  pets: z.array(petSchema)
});

export async function GET() {
  try {
    return NextResponse.json(await loadDesktopPetBundle());
  } catch (error) {
    return NextResponse.json(
      {
        error: "DESKTOP_BUNDLE_LOAD_FAILED",
        details: error instanceof Error ? error.message : "Failed to load desktop bundle."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bundleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_DESKTOP_BUNDLE",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await saveDesktopPetBundle(parsed.data));
  } catch (error) {
    return NextResponse.json(
      {
        error: "DESKTOP_BUNDLE_SAVE_FAILED",
        details: error instanceof Error ? error.message : "Failed to save desktop bundle."
      },
      { status: 500 }
    );
  }
}
