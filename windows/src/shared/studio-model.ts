import type { DesktopAccountSession } from "./settings-store.ts";

type SyncedPetState = {
  ownership?: string | null;
  displayState?: string | null;
};

type SyncedPetActionState = SyncedPetState & {
  id: string;
};

type FriendActionState = {
  id: string;
};

export function accountDetail(account: DesktopAccountSession | undefined) {
  if (!account) {
    return "登录后可同步网页端账号下的宠物数据。";
  }

  return `${account.email} · ${account.credits} 积分`;
}

export function statusTextForSyncedPet(pet: SyncedPetState) {
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
