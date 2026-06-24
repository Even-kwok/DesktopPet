import type { DesktopAccountSession } from "./settings-store.ts";

type SyncedPetState = {
  ownership?: string | null;
  displayState?: string | null;
};

type SyncedPetActionState = SyncedPetState & {
  id: string;
};

type SyncedPetCardAction =
  | { type: "select"; label: "选择" }
  | { type: "recall"; label: "召回" };

type HostingRequestState = {
  requestId?: string;
  status: string;
  petId?: string;
  toUserId?: string;
};

type FriendActionState = {
  id: string;
};

type FriendHostingDetailState = {
  status: string;
  hostedPets: number;
};

type LocalMaterialStatusState = {
  hasVideo: boolean;
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
  return "Windows 端只负责显示、同步、好友寄养和召回；素材生成放在网页端。";
}

export function friendHostingDetail(friend: FriendHostingDetailState) {
  return `${friend.status} · 托管 ${friend.hostedPets} 只`;
}

export function friendPanelTitle() {
  return "好友";
}

export function friendPanelDetail(friendCount: number) {
  return `${friendCount} 位 · 可寄养和删除`;
}

export function friendPanelEmptyTitle() {
  return "还没有好友";
}

export function friendPanelEmptyDetail() {
  return "用账号邮箱精确添加。在线状态先按服务器记录显示。";
}

export function localMaterialStatusText(material: LocalMaterialStatusState) {
  return material.hasVideo ? "已有视频" : "未生成";
}

export function localMaterialBoardTitle() {
  return "动作卡册";
}

export function localMaterialBoardDetail() {
  return "有素材的动作会在对应场景出现。";
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
    return "托管在朋友那里";
  }

  switch (pet.displayState) {
    case "active":
      return pet.ownership === "hosted" ? "寄养在我的桌面" : "在我的桌面";
    case "unavailable":
      return "托管在朋友那里";
    case "hidden":
      return "已隐藏";
    default:
      return "等待同步";
  }
}

export function canRequestHosting(pet: SyncedPetState) {
  return pet.ownership === "owned" && pet.displayState === "active";
}

export function canRecall(pet: SyncedPetState) {
  return pet.displayState === "unavailable" || pet.ownership === "away";
}

export function shouldShowRecallAction(pet: SyncedPetState, isSelected: boolean) {
  return isSelected && canRecall(pet);
}

export function syncedPetCardAction(
  pet: SyncedPetState,
  isSelected: boolean
): SyncedPetCardAction | undefined {
  if (shouldShowRecallAction(pet, isSelected)) {
    return { type: "recall", label: "召回" };
  }

  if (!isSelected) {
    return { type: "select", label: "选择" };
  }

  return undefined;
}

export function resolveHostingRequestTarget(
  petId: string,
  toUserId: string,
  syncedPetCards: readonly SyncedPetActionState[],
  friendCards: readonly FriendActionState[]
) {
  const selectedPet = syncedPetCards.find((pet) => pet.id === petId);
  if (!selectedPet) {
    throw new Error("请先同步并选择一只猫咪。");
  }

  const selectedFriend = friendCards.find((friend) => friend.id === toUserId);
  if (!selectedFriend) {
    throw new Error("请选择一位好友。");
  }

  if (!canRequestHosting(selectedPet)) {
    throw new Error("这只猫现在不在我的桌面，先召回再寄养。");
  }

  return {
    petId: selectedPet.id,
    toUserId: selectedFriend.id
  };
}

export function syncedPetCardsAfterHostingRequest<T extends SyncedPetActionState>(
  syncedPetCards: readonly T[],
  _response: HostingRequestState
) {
  return syncedPetCards;
}

export function resolveRecallPetTarget(
  petId: string,
  syncedPetCards: readonly SyncedPetActionState[]
) {
  const selectedPet = syncedPetCards.find((pet) => pet.id === petId);
  if (!selectedPet) {
    throw new Error("请先同步并选择一只猫咪。");
  }

  if (!canRecall(selectedPet)) {
    throw new Error("这只猫不需要召回。");
  }

  return {
    petId: selectedPet.id
  };
}

export function resolveFriendRemovalTarget(
  friendId: string,
  friendCards: readonly FriendActionState[]
) {
  const selectedFriend = friendCards.find((friend) => friend.id === friendId);
  if (!selectedFriend) {
    throw new Error("请选择一位好友。");
  }

  return {
    friendId: selectedFriend.id
  };
}
