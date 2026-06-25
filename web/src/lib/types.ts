import type { MaterialSlot } from "@/lib/material-slots";
import type { VideoGenerationSettings } from "@/lib/generation-settings";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  credits: number;
};

export type ReferralSettings = {
  rewardPercent: number;
  firstRechargeDiscountPercent: number;
};

export type ReferralCodeStatus = "active" | "disabled";

export type ReferralCode = {
  id: string;
  code: string;
  ownerUserId: string;
  ownerName?: string;
  ownerEmail?: string;
  status: ReferralCodeStatus;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  referredUsers?: number;
  rewardAmountCents?: number;
  rewardCredits?: number;
};

export type UserReferral = {
  referredUserId: string;
  referralCodeId: string;
  referralCode: string;
  referrerUserId: string;
  registeredAt: string;
  rewardPercentAtRegistration: number;
  firstRechargeDiscountPercentAtRegistration: number;
  firstRechargeDiscountUsedAt?: string | null;
};

export type RechargeRecordStatus = "pending" | "paid" | "failed" | "refunded";

export type RechargeRecord = {
  id: string;
  userId: string;
  provider: string;
  providerTransactionId?: string | null;
  amountCents: number;
  currency: string;
  creditsGranted: number;
  status: RechargeRecordStatus;
  discountPercent: number;
  discountAmountCents: number;
  referralCodeId?: string | null;
  referredByUserId?: string | null;
  paidAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReferralRewardLedgerEntry = {
  id: string;
  referrerUserId: string;
  referrerName?: string;
  referrerEmail?: string;
  referredUserId: string;
  referredUserName?: string;
  referredUserEmail?: string;
  referralCodeId: string;
  referralCode?: string;
  rechargeRecordId: string;
  amountCents: number;
  currency: string;
  rewardPercent: number;
  rewardAmountCents: number;
  rewardCredits: number;
  status: "posted" | "voided";
  createdAt: string;
};

export type ReferralSummary = {
  activeCode?: ReferralCode | null;
  referredUsers: number;
  rewardAmountCents: number;
  rewardCredits: number;
  rewardPercent: number;
  firstRechargeDiscountPercent: number;
  rewards: ReferralRewardLedgerEntry[];
};

export type AdminReferralOverview = {
  settings: ReferralSettings;
  codes: ReferralCode[];
  rechargeRecords: RechargeRecord[];
  rewards: ReferralRewardLedgerEntry[];
};

export type Pet = {
  id: string;
  petNumber: string;
  ownerUserId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  currentHostUserId?: string | null;
  name: string;
  type: "cat" | "dog";
  status: string;
  materialsReady: number;
  mood: string;
  host: "me" | "friend" | "away";
  ownership: PetOwnership;
  locationStatus: PetLocationStatus;
  sourceImageUrl?: string | null;
  frontImageUrl?: string | null;
  isReadonly?: boolean;
};

export type PetOwnership = "owned" | "hosted" | "away";

export type PetLocationStatus = "at_owner_desktop" | "hosted_by_friend" | "away";

export type Friend = {
  id: string;
  name: string;
  status: "在线" | "离线";
  hostedPets: number;
};

export type HostingRequestStatusCode = "pending" | "accepted" | "declined" | "returned";

export type HostingRequestAction = "accept" | "decline" | "return";

export type HostingRequest = {
  id: string;
  petId: string;
  fromUserId: string;
  toUserId: string;
  petName: string;
  from: string;
  status: string;
  statusCode: HostingRequestStatusCode;
};

export type DesktopEventType =
  | "hosting_request_created"
  | "hosting_request_accepted"
  | "hosting_request_declined"
  | "pet_recalled"
  | "desktop_bundle_changed";

export type DesktopEvent = {
  id: string;
  userId: string;
  type: DesktopEventType;
  actorUserId?: string | null;
  petId?: string | null;
  hostingRequestId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
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
  updatedAt?: string;
};

export type DesktopPetBundlePet = {
  id: string;
  petNumber: string;
  ownerUserId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  currentHostUserId?: string | null;
  name: string;
  type: "cat" | "dog";
  ownership: PetOwnership;
  displayState: "active" | "hidden" | "unavailable";
  avatarUrl?: string | null;
  materials: DesktopPetMaterial[];
};

export type DesktopAccountSyncSummary = {
  id: string;
  name: string;
  email: string;
  credits: number;
};

export type DesktopSyncMetadata = {
  mode: BackendMode;
  source: "mock" | "account";
  recommendedPollSeconds: number;
};

export type DesktopPetBundle = {
  version: 1;
  generatedAt: string;
  account?: DesktopAccountSyncSummary | null;
  sync?: DesktopSyncMetadata;
  pets: DesktopPetBundlePet[];
};

export type DesktopPetBundlePublishResponse = {
  mode: BackendMode;
  bucket: string;
  storagePath: string;
  publicUrl?: string;
  bundle: DesktopPetBundle;
};

export type DesktopLoginResponse = {
  mode: BackendMode;
  tokenType: "bearer";
  accessToken: string;
  expiresIn: number;
  account: CurrentUser;
};

export type PetDeleteResponse = {
  deletedPetId: string;
  deletedAssets: number;
};

export type PetCreateResponse = {
  pet: Pet;
};

export type PetMaterialSaveResponse = {
  asset: PetAsset;
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
  jobs: GenerationJob[];
  materialSlots: MaterialSlot[];
  referralSummary: ReferralSummary;
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
  pet?: Pet;
};
