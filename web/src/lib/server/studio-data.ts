import { materialSlots } from "@/lib/material-slots";
import {
  currentUser,
  friends,
  hostingRequests,
  petAssets,
  pets
} from "@/lib/mock-data";
import type { GenerationJob, StudioBootstrap } from "@/lib/types";

export function getStudioBootstrap(): StudioBootstrap {
  return {
    user: currentUser,
    pets,
    friends,
    hostingRequests,
    assets: petAssets,
    materialSlots
  };
}

export function createMockGenerationJob(input: {
  type: "front_image" | "action_video";
  petId: string;
  slot?: string;
  cost: number;
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
    createdAt: new Date().toISOString()
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
