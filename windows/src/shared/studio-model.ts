import type { DesktopAccountSession } from "./settings-store.ts";

type SyncedPetState = {
  ownership?: string | null;
  displayState?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
};

type SyncedPetCardAction =
  | { type: "select"; label: "选择" };

type LocalMaterialStatusState = {
  hasVideo: boolean;
};

type LocalMaterialPreviewState = LocalMaterialStatusState & {
  isPreviewing: boolean;
};

export function accountDisplayName(account: DesktopAccountSession | undefined) {
  return account?.name ?? "未登录";
}

export function accountDetail(account: DesktopAccountSession | undefined) {
  if (!account) {
    return "登录后可同步网页端账号下的宠物数据。";
  }

  return `${account.email} · ${account.credits} 积分`;
}

export function loginPanelTitle() {
  return "登录后同步你的猫咪";
}

export function loginPanelDetail() {
  return "Windows 端只负责显示和同步；素材生成放在网页端。";
}

export function canSubmitLogin(_email: string, _password: string, isLoggingIn = false) {
  return !isLoggingIn;
}

export function loginValidationMessage(email: string, password: string) {
  return email.trim() && password ? undefined : "请输入邮箱和密码。";
}

export function canSyncDesktopBundle(
  account: DesktopAccountSession | undefined,
  isSyncingDesktopBundle = false
) {
  return Boolean(account && !isSyncingDesktopBundle);
}

export function localMaterialStatusText(material: LocalMaterialStatusState) {
  return material.hasVideo ? "已有视频" : "未生成";
}

export function localMaterialPreviewAction(material: LocalMaterialPreviewState) {
  return {
    label: material.isPreviewing ? "停止" : "预览",
    disabled: !material.hasVideo
  };
}

export function localMaterialPreviewHint(material: LocalMaterialStatusState) {
  return material.hasVideo ? "点预览播放" : "等待素材";
}

export function localMaterialBoardTitle() {
  return "动作卡册";
}

export function localMaterialBoardDetail() {
  return "有素材的动作会在对应场景出现；点预览看看效果。";
}

export function syncedPetPanelTitle() {
  return "我的猫咪";
}

export function syncedPetPanelDetail(petCount: number) {
  return `${petCount} 只`;
}

export function syncedPetPanelEmptyTitle() {
  return "还没有同步猫咪";
}

export function syncedPetPanelEmptyDetail() {
  return "点右上角同步，从网页端拉取账号下的猫咪和素材。";
}

export function statusTextForSyncedPet(pet: SyncedPetState) {
  if (pet.ownership === "away") {
    return "暂不可显示";
  }

  switch (pet.displayState) {
    case "active":
      return "在我的桌面";
    case "unavailable":
      return "暂不可显示";
    case "hidden":
      return "已隐藏";
    default:
      return "等待同步";
  }
}

export function syncedPetCardAction(
  pet: SyncedPetState,
  isSelected: boolean
): SyncedPetCardAction | undefined {
  if (!isSelected) {
    return { type: "select", label: "选择" };
  }

  return undefined;
}
