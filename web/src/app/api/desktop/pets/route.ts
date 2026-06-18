import { NextResponse } from "next/server";
import { z } from "zod";
import { loadDesktopPetBundle, saveDesktopPetBundle } from "@/lib/server/desktop-bundle-store";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { getDesktopAuthContext } from "@/lib/server/desktop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const materialSchema = z.object({
  slot: z.string().min(1),
  name: z.string().min(1),
  videoUrl: z.string().url(),
  status: z.literal("ready"),
  updatedAt: z.string().min(1).optional()
});

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  credits: z.number().int().nonnegative()
});

const syncSchema = z.object({
  mode: z.enum(["mock", "supabase"]),
  source: z.enum(["mock", "account"]),
  recommendedPollSeconds: z.number().int().positive()
});

const petSchema = z.object({
  id: z.string().min(1),
  petNumber: z.string().min(1),
  ownerUserId: z.string().min(1),
  currentHostUserId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  type: z.enum(["cat", "dog"]),
  ownership: z.enum(["owned", "hosted", "away"]),
  displayState: z.enum(["active", "hidden", "unavailable"]),
  avatarUrl: z.string().url().nullable().optional(),
  materials: z.array(materialSchema)
});

const bundleSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().min(1),
  account: accountSchema.nullable().optional(),
  sync: syncSchema.optional(),
  pets: z.array(petSchema)
});

export async function GET(request: Request) {
  const auth = await getDesktopAuthContext(request);

  if (!auth.user) {
    return NextResponse.json({ error: "DESKTOP_AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadDesktopPetBundle(auth.user));
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
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

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
