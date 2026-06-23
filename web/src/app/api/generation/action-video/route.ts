import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertAccountPetEditable,
  createAccountGenerationJob,
  findActiveAccountGenerationJob
} from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { loadVideoGenerationSettings } from "@/lib/server/generation-settings-store";
import { getAdminMaterialConfig } from "@/lib/server/material-library-store";
import { createJimengVideoJob } from "@/lib/server/jimeng";
import { createMockGenerationJob } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const requestSchema = z.object({
  petId: z.string().min(1),
  slot: z.string().min(1),
  sourceImageUrl: z.string().url().optional(),
  lastImageUrl: z.string().url().optional()
});

export async function POST(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
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

  const materialConfig = await getAdminMaterialConfig(parsed.data.slot);

  if (!materialConfig || !materialConfig.enabled) {
    return NextResponse.json({ error: "UNKNOWN_MATERIAL_CONFIG" }, { status: 404 });
  }

  try {
    await assertAccountPetEditable({
      account: auth.user,
      petId: parsed.data.petId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PET_NOT_FOUND";

    return NextResponse.json(
      {
        error:
          message === "PET_NOT_FOUND" || message === "PET_READONLY"
            ? message
            : "ACTION_VIDEO_GENERATION_FAILED",
        details:
          message === "PET_READONLY"
            ? "体验猫的素材不能重新生成，可以添加新的猫咪后编辑。"
            : message
      },
      { status: message === "PET_NOT_FOUND" ? 404 : message === "PET_READONLY" ? 403 : 500 }
    );
  }

  const activeJob = await findActiveAccountGenerationJob({
    account: auth.user,
    petId: parsed.data.petId,
    slot: parsed.data.slot,
    type: "action_video"
  });

  if (activeJob) {
    return NextResponse.json(activeJob);
  }

  const cost = materialConfig.costCredits;
  const savedSettings = await loadVideoGenerationSettings();
  const settings = {
    ...savedSettings,
    durationSeconds: materialConfig.durationSeconds
  };

  if (parsed.data.sourceImageUrl) {
    try {
      const providerJob = await createJimengVideoJob({
        petId: parsed.data.petId,
        slot: parsed.data.slot,
        sourceImageUrl: parsed.data.sourceImageUrl,
        lastImageUrl: parsed.data.lastImageUrl ?? parsed.data.sourceImageUrl,
        settings,
        cost
      });

      if (providerJob) {
        const storedJob = await createAccountGenerationJob({
          account: auth.user,
          job: providerJob,
          provider: "jimeng"
        });

        return NextResponse.json(storedJob);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Provider request failed.";

      console.error("Jimeng video generation request failed", {
        petId: parsed.data.petId,
        slot: parsed.data.slot,
        message
      });

      return NextResponse.json(
        {
          error: "JIMENG_VIDEO_GENERATION_FAILED",
          details: message
        },
        { status: 502 }
      );
    }
  }

  const mockJob = createMockGenerationJob({
    type: "action_video",
    petId: parsed.data.petId,
    slot: parsed.data.slot,
    cost,
    settings
  });

  return NextResponse.json(
    await createAccountGenerationJob({
      account: auth.user,
      job: mockJob,
      provider: "mock"
    })
  );
}
