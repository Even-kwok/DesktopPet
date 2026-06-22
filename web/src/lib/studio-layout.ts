import type { MaterialSlot } from "./material-slots";
import type { GenerationJob, Pet, PetAsset, PetAssetStatus } from "./types";

export function petPanelImageUrl(pet: Pet | undefined, sourcePreviewUrl: string | null) {
  return sourcePreviewUrl ?? pet?.frontImageUrl ?? pet?.sourceImageUrl ?? null;
}

export type PetPanelStat = {
  label: string;
  value: number;
};

export function petPanelStats(_input: { readyCount: number }): PetPanelStat[] {
  return [];
}

export type StudioStatusTone = "info" | "success" | "error";

export function studioStatusMessageClassName(tone: StudioStatusTone) {
  return `studio-status-message ${tone}`;
}

function nameEditControlCopy(label: string, name: string) {
  return {
    ariaLabel: `${label}：${name}`,
    className: "icon-edit-button",
    icon: "✎"
  };
}

export function accountNameEditControlCopy(accountName: string) {
  return nameEditControlCopy("编辑账号名称", accountName);
}

export function petNameEditControlCopy(petName: string) {
  return nameEditControlCopy("编辑猫咪名字", petName);
}

export type MaterialCardPreviewState =
  | { kind: "empty" }
  | { kind: "icon"; icon: string }
  | { kind: "video"; videoUrl: string };

export function materialCardPreviewState(input: {
  asset?: Pick<PetAsset, "status" | "videoUrl">;
  hasActiveJob: boolean;
  isSubmitting: boolean;
}): MaterialCardPreviewState {
  if (input.asset?.videoUrl) {
    return { kind: "video", videoUrl: input.asset.videoUrl };
  }

  const status = input.asset?.status ?? "missing";
  const isGenerating =
    input.hasActiveJob || input.isSubmitting || status === "queued" || status === "generating";

  return isGenerating ? { kind: "icon", icon: "⏳" } : { kind: "empty" };
}

export function jobDisplayName(
  job: GenerationJob,
  slots: Pick<MaterialSlot, "id" | "name">[]
) {
  if (job.type === "front_image") {
    return "形象图任务";
  }

  if (!job.slot) {
    return "素材任务";
  }

  return slots.find((slot) => slot.id === job.slot)?.name ?? "素材任务";
}

export function jobGeneratedAtLabel(job: Pick<GenerationJob, "createdAt">) {
  if (!job.createdAt) {
    return null;
  }

  const createdAt = new Date(job.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(createdAt)
    .reduce<Record<string, string>>((currentParts, part) => {
      if (part.type !== "literal") {
        currentParts[part.type] = part.value;
      }

      return currentParts;
    }, {});

  return `生成时间：${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export type JobGeneratedVideoApplyAction =
  | { kind: "hidden" }
  | { kind: "available"; label: string }
  | { kind: "unavailable"; label: string; reason: string };

export function jobGeneratedVideoApplyAction(
  job: Pick<GenerationJob, "type" | "status" | "petId" | "slot" | "resultUrl">,
  pets: Pick<Pet, "id">[]
): JobGeneratedVideoApplyAction {
  if (job.type !== "action_video" || job.status !== "succeeded" || !job.resultUrl || !job.slot) {
    return { kind: "hidden" };
  }

  const petExists = pets.some((pet) => pet.id === job.petId);

  if (!petExists) {
    return {
      kind: "unavailable",
      label: "宠物已删除",
      reason: "原猫咪已删除，无法应用到动作包。"
    };
  }

  return {
    kind: "available",
    label: "应用到动作包"
  };
}

export function assetStatusAfterGenerationFailure(
  asset: Pick<PetAsset, "videoUrl"> | undefined
): PetAssetStatus {
  return asset?.videoUrl ? "ready" : "failed";
}
