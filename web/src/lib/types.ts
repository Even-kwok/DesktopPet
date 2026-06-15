import type { MaterialSlot } from "@/lib/material-slots";
import type { VideoGenerationSettings } from "@/lib/generation-settings";

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

export type DesktopPetMaterial = {
  slot: string;
  name: string;
  videoUrl: string;
  status: "ready";
};

export type DesktopPetBundlePet = {
  id: string;
  name: string;
  type: "cat" | "dog";
  avatarUrl?: string | null;
  materials: DesktopPetMaterial[];
};

export type DesktopPetBundle = {
  version: 1;
  generatedAt: string;
  pets: DesktopPetBundlePet[];
};

export type DesktopPetBundlePublishResponse = {
  mode: BackendMode;
  bucket: string;
  storagePath: string;
  publicUrl?: string;
  bundle: DesktopPetBundle;
};

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

export type GenerationJob = {
  jobId: string;
  type: "front_image" | "action_video";
  status: GenerationJobStatus;
  cost: number;
  petId: string;
  slot?: string;
  progress?: number;
  resultUrl?: string | null;
  lastFrameUrl?: string | null;
  message?: string;
  createdAt?: string;
  prompt?: string;
  settings?: VideoGenerationSettings;
  sourceImageUrl?: string;
  lastImageUrl?: string;
};

export type StudioBootstrap = {
  user: CurrentUser;
  pets: Pet[];
  friends: Friend[];
  hostingRequests: HostingRequest[];
  assets: PetAsset[];
  materialSlots: MaterialSlot[];
  backend: BackendStatus;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
};

export type BackendMode = "mock" | "supabase";

export type BackendStatus = {
  mode: BackendMode;
  supabaseConfigured: boolean;
  authConfigured: boolean;
  storageConfigured: boolean;
  serviceRoleConfigured: boolean;
  serviceRoleLooksValid: boolean;
  serviceRoleRole: string | null;
  sourceImageBucket: string;
  frontImageBucket: string;
  actionVideoBucket: string;
  missingEnv: string[];
  message: string;
};

export type SourceImageUploadResponse = {
  mode: BackendMode;
  bucket: string;
  storagePath: string;
  publicUrl: string;
};
