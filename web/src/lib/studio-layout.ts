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

export type ClientPlatformId = "mac" | "windows" | "ios" | "android";

export type ClientPlatformCard = {
  id: ClientPlatformId;
  title: string;
  description: string;
  statusLabel: string;
  actionLabel: string;
  actionUrl: string | null;
  isEnabled: boolean;
};

export function buildClientPlatformCards(
  macDownloadUrl: string | null,
  windowsDownloadUrl: string | null = null
): ClientPlatformCard[] {
  const normalizedMacUrl = macDownloadUrl?.trim() || null;
  const normalizedWindowsUrl = windowsDownloadUrl?.trim() || null;

  return [
    {
      id: "mac",
      title: "Mac 端",
      description: "桌面宠物主客户端，同步账号内已生成动作。",
      statusLabel: normalizedMacUrl ? "可下载" : "优先入口",
      actionLabel: normalizedMacUrl ? "下载 Mac 版" : "安装包准备中",
      actionUrl: normalizedMacUrl,
      isEnabled: Boolean(normalizedMacUrl)
    },
    {
      id: "windows",
      title: "Windows 端",
      description: "Windows 桌面宠物客户端，同步账号内已生成动作。",
      statusLabel: normalizedWindowsUrl ? "可下载" : "安装包准备中",
      actionLabel: normalizedWindowsUrl ? "下载 Windows 版" : "安装包准备中",
      actionUrl: normalizedWindowsUrl,
      isEnabled: Boolean(normalizedWindowsUrl)
    },
    {
      id: "ios",
      title: "iOS / iPadOS",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "android",
      title: "Android",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    }
  ];
}

export type MaterialWorkflowStep = {
  title: string;
  state: string;
};

export function buildMaterialWorkflowSteps(input: {
  hasFrameImage: boolean;
  basicReadyCount: number;
  basicTotalCount: number;
  totalReadyCount: number;
  hasMacDownload: boolean;
  hasWindowsDownload?: boolean;
}): MaterialWorkflowStep[] {
  return [
    {
      title: "上传绿幕图",
      state: input.hasFrameImage ? "已就位" : "待上传"
    },
    {
      title: "补齐基础版",
      state: `${input.basicReadyCount}/${input.basicTotalCount}`
    },
    {
      title: "准备客户端",
      state: clientDownloadState(input)
    },
    {
      title: "同步到桌面",
      state: input.totalReadyCount > 0 ? "可同步" : "待动作"
    }
  ];
}

function clientDownloadState(input: { hasMacDownload: boolean; hasWindowsDownload?: boolean }) {
  if (input.hasMacDownload && input.hasWindowsDownload) {
    return "桌面端可下载";
  }

  if (input.hasMacDownload) {
    return "Mac 可下载";
  }

  if (input.hasWindowsDownload) {
    return "Windows 可下载";
  }

  return "安装包准备中";
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
