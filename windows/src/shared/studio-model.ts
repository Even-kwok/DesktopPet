import type { DesktopAccountSession } from "./settings-store.ts";

type SyncedPetState = {
  ownership?: string | null;
  displayState?: string | null;
};

type SyncedPetActionState = SyncedPetState & {
  id: string;
};

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

export function accountDetail(account: DesktopAccountSession | undefined) {
  if (!account) {
    return "登录后可同步网页端账号下的宠物数据。";
  }

  return `${account.email} · ${account.credits} 积分`;
}

export function friendHostingDetail(friend: FriendHostingDetailState) {
  return `${friend.status} · 托管 ${friend.hostedPets} 只`;
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
