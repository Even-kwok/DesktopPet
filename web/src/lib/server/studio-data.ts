import { currentUser } from "@/lib/mock-data";
import type { VideoGenerationSettings } from "@/lib/generation-settings";
import {
  loadAccountDataSnapshot,
  refreshAccountGenerationJobs
} from "@/lib/server/account-data-store";
import { listPublicMaterialSlots } from "@/lib/server/material-library-store";
import { getBackendStatus } from "@/lib/supabase/server";
import type { CurrentUser, GenerationJob, StudioBootstrap } from "@/lib/types";

export async function getStudioBootstrap(user: CurrentUser = currentUser): Promise<StudioBootstrap> {
  await refreshAccountGenerationJobs(user);

  const [snapshot, materialSlots] = await Promise.all([
    loadAccountDataSnapshot(user),
    listPublicMaterialSlots()
  ]);

  return {
    user: snapshot.user,
    pets: snapshot.pets,
    friends: snapshot.friends,
    hostingRequests: snapshot.hostingRequests,
    assets: snapshot.assets,
    jobs: snapshot.generationJobs,
    materialSlots,
    backend: getBackendStatus()
  };
}

export function createMockGenerationJob(input: {
  type: "front_image" | "action_video";
  petId: string;
  slot?: string;
  cost: number;
  settings?: VideoGenerationSettings;
}): GenerationJob {
  return {
    jobId: `${input.type === "front_image" ? "front" : "video"}_${crypto.randomUUID()}`,
    type: input.type,
    status: "queued",
    cost: input.cost,
    petId: input.petId,
    slot: input.slot,
    progress: 0,
    resultUrl: null,
    createdAt: new Date().toISOString(),
    settings: input.settings
  };
}

export function getMockJobResult(jobId: string): GenerationJob {
  const isFrontImage = jobId.startsWith("front_");

  return {
    jobId,
    type: isFrontImage ? "front_image" : "action_video",
    status: "succeeded",
    cost: isFrontImage ? 10 : 12,
    petId: "pet_orange",
    progress: 100,
    resultUrl: null,
    message: "Mock job result. Real provider wiring comes next.",
    createdAt: new Date().toISOString()
  };
}
