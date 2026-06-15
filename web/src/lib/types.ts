import type { MaterialSlot } from "@/lib/material-slots";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  credits: number;
};

export type Pet = {
  id: string;
  name: string;
  type: "cat" | "dog";
  status: string;
  materialsReady: number;
  mood: string;
  host: "me" | "friend" | "away";
  sourceImageUrl?: string | null;
  frontImageUrl?: string | null;
};

export type Friend = {
  id: string;
  name: string;
  status: "在线" | "离线";
  hostedPets: number;
};

export type HostingRequest = {
  id: string;
  petName: string;
  from: string;
  status: string;
};

export type PetAssetStatus = "missing" | "queued" | "generating" | "ready" | "failed";

export type PetAsset = {
  petId: string;
  slot: string;
  status: PetAssetStatus;
  videoUrl?: string | null;
};

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed";

export type GenerationJob = {
  jobId: string;
  type: "front_image" | "action_video";
  status: GenerationJobStatus;
  cost: number;
  petId: string;
  slot?: string;
  progress?: number;
  resultUrl?: string | null;
  message?: string;
  createdAt?: string;
};

export type StudioBootstrap = {
  user: CurrentUser;
  pets: Pet[];
  friends: Friend[];
  hostingRequests: HostingRequest[];
  assets: PetAsset[];
  materialSlots: MaterialSlot[];
};

export type UploadUrlResponse = {
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
};
