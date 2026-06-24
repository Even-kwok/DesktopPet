import { useEffect, useMemo, useState } from "react";
import {
  allPetActionSlots,
  materialGroupForSlot,
  materialGroupDescription,
  materialGroupTitle,
  petActionSlotDisplayName,
  petActionSlotTriggerDescription
} from "../../shared/pet-action-slots.ts";
import type { PetActionSlot, PetMaterialGroup } from "../../shared/pet-action-slots.ts";
import type { DesktopFriendCard } from "../../shared/desktop-sync-client.ts";
import type { DesktopAccountSession, DesktopSyncedPetCard } from "../../shared/settings-store.ts";
import type { DesktopPetBridge } from "../../preload/index.ts";
import {
  accountDetail,
  accountDisplayName,
  canSubmitLogin,
  canSyncDesktopBundle,
  canRefreshFriends,
  canRequestFriendHosting,
  canRunFriendMutation,
  canSubmitFriendEmail,
  friendEmailInputPlaceholder,
  friendHostingDetail,
  friendPanelDetail,
  friendPanelEmptyDetail,
  friendPanelEmptyTitle,
  friendPanelTitle,
  loginPanelDetail,
  loginPanelTitle,
  localMaterialBoardDetail,
  localMaterialBoardTitle,
  localMaterialPreviewAction,
  localMaterialStatusText,
  shouldSubmitFriendEmailKey,
  loginValidationMessage,
  syncedPetCardAction,
  syncedPetPanelDetail,
  syncedPetPanelEmptyDetail,
  syncedPetPanelEmptyTitle,
  syncedPetPanelTitle,
  statusTextForSyncedPet
} from "../../shared/studio-model.ts";
import {
  nextFriendEmailDraftAfterAddFriendAction,
  nextFriendEmailDraftAfterSignOutAction,
  pendingStatusMessageForAddFriendAction,
  pendingStatusMessageForHostingRequestAction,
  pendingStatusMessageForImportVideoAction,
  pendingStatusMessageForRecallAction,
  pendingStatusMessageForRemoveFriendAction,
  pendingStatusMessageForSignInAction,
  pendingStatusMessageForSyncAction,
  statusMessageForAddFriendAction,
  statusMessageForAddFriendError,
  statusMessageForRemoveFriendAction,
  statusMessageForRefreshFriendsAction,
  statusMessageForHostingRequestAction,
  statusMessageForImportVideoAction,
  statusMessageForRecallAction,
  statusMessageForRemoveVideoAction,
  statusMessageForSignInAction,
  statusMessageForSignOutAction,
  statusMessageForSyncAction
} from "./studio-action-result.ts";
import { toVideoSource } from "../pet/pet-playback-command.ts";
import {
  nextSelectedPetIndexAfterStudioRefresh,
  nextSelectedSyncedPetID,
  petNameDraftForIndex,
  studioPetCountForDisplay,
  studioPetIndexesForDisplay
} from "./studio-selection.ts";
import { runStudioAction } from "./studio-action-runner.ts";
import {
  isSelectedStudioPetSize,
  studioPetSizeOptions
} from "./studio-size.ts";

declare global {
  interface Window {
    desktopPet?: DesktopPetBridge;
  }
}

type StudioState = {
  account?: DesktopAccountSession;
  petCount: number;
  petNames: string[];
  selectedSyncedPetID?: string;
  syncedPetCards: DesktopSyncedPetCard[];
  friendCards: DesktopFriendCard[];
  localVideoSlots: PetActionSlot[][];
  localVideoPaths: Partial<Record<PetActionSlot, string>>[];
  petSizeScales: number[];
  isPetVisible: boolean;
  isClickThrough: boolean;
  isMouseoverCatchEnabled: boolean;
};

const defaultStudioState: StudioState = {
  account: undefined,
  petCount: 1,
  petNames: ["Pet 1"],
  selectedSyncedPetID: undefined,
  syncedPetCards: [],
  friendCards: [],
  localVideoSlots: [[]],
  localVideoPaths: [{}],
  petSizeScales: [1],
  isPetVisible: false,
  isClickThrough: false,
  isMouseoverCatchEnabled: true
};

export function StudioApp() {
  const [state, setState] = useState<StudioState>(defaultStudioState);
  const [email, setEmail] = useState("demo@desktop.pet");
  const [password, setPassword] = useState("123456");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedPetIndex, setSelectedPetIndex] = useState(0);
  const [petNameDraft, setPetNameDraft] = useState("Pet 1");
  const [friendEmail, setFriendEmail] = useState("");
  const [isSyncingDesktopBundle, setIsSyncingDesktopBundle] = useState(false);
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  const [isMutatingFriend, setIsMutatingFriend] = useState(false);
  const [selectedSyncedPetID, setSelectedSyncedPetID] = useState<string | undefined>();
  const [previewingMaterialSlot, setPreviewingMaterialSlot] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState("");

  const bridge = window.desktopPet;

  const refreshState = async (actionResult?: unknown, studioCommand?: unknown) => {
    const nextState = (await bridge?.getStudioState?.()) as StudioState | undefined;
    if (nextState) {
      const mergedState = { ...defaultStudioState, ...nextState };
      setState(mergedState);
      setSelectedPetIndex((current) => {
        const nextPetIndex = nextSelectedPetIndexAfterStudioRefresh(
          current,
          mergedState,
          actionResult,
          studioCommand
        );
        setPetNameDraft(petNameDraftForIndex(mergedState, nextPetIndex));
        return nextPetIndex;
      });
      setSelectedSyncedPetID((current) =>
        nextSelectedSyncedPetID(current, mergedState.selectedSyncedPetID, mergedState.syncedPetCards)
      );
    }
  };

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    return bridge?.onStudioCommand?.((command) => {
      void refreshState(undefined, command);
    });
  }, [bridge]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<PetMaterialGroup, PetActionSlot[]>();
    allPetActionSlots.forEach((slot) => {
      const group = materialGroupForSlot(slot);
      groups.set(group, [...(groups.get(group) ?? []), slot]);
    });
    return Array.from(groups.entries());
  }, []);

  const runAction = async (
    action: () => Promise<unknown> | unknown,
    successMessage: string,
    afterSuccess?: (result: unknown) => string | void,
    afterError?: (error: unknown) => string | void
  ) => {
    await runStudioAction({
      action,
      refreshState,
      setStatusMessage,
      successMessage,
      afterSuccess,
      afterError
    });
  };

  const account = state.account;
  const selectedSyncedPet =
    state.syncedPetCards.find((pet) => pet.id === selectedSyncedPetID) ?? state.syncedPetCards[0];
  const displayedPetCount = studioPetCountForDisplay(state.petCount);
  const displayedPetIndexes = studioPetIndexesForDisplay(state.petCount);

  const signIn = async () => {
    if (!canSubmitLogin(email, password, isLoggingIn)) {
      return;
    }

    const validationMessage = loginValidationMessage(email, password);
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    setStatusMessage(pendingStatusMessageForSignInAction());
    setIsLoggingIn(true);
    try {
      await runAction(() => bridge?.signIn?.(email, password), statusMessageForSignInAction());
    } finally {
      setIsLoggingIn(false);
    }
  };

  const syncDesktopBundle = async () => {
    if (!canSyncDesktopBundle(account, isSyncingDesktopBundle)) {
      return;
    }

    setStatusMessage(pendingStatusMessageForSyncAction());
    setIsSyncingDesktopBundle(true);
    try {
      await runAction(
        () => bridge?.sync?.(),
        "已同步网页端素材。",
        (result) => statusMessageForSyncAction(result)
      );
    } finally {
      setIsSyncingDesktopBundle(false);
    }
  };

  const refreshFriends = async () => {
    if (!canRefreshFriends(account, isRefreshingFriends)) {
      return;
    }

    setIsRefreshingFriends(true);
    try {
      await runAction(
        () => bridge?.refreshFriends?.(),
        "好友列表已刷新。",
        (result) => statusMessageForRefreshFriendsAction(result)
      );
    } finally {
      setIsRefreshingFriends(false);
    }
  };

  const runFriendMutation = async (
    action: () => Promise<unknown> | unknown,
    successMessage: string,
    afterSuccess?: (result: unknown) => string | void,
    afterError?: (error: unknown) => string | void
  ) => {
    if (!canRunFriendMutation(account, isMutatingFriend)) {
      return;
    }

    setIsMutatingFriend(true);
    try {
      await runAction(action, successMessage, afterSuccess, afterError);
    } finally {
      setIsMutatingFriend(false);
    }
  };

  const submitFriendEmail = async () => {
    if (!canSubmitFriendEmail(account, friendEmail, isMutatingFriend)) {
      return;
    }

    setStatusMessage(pendingStatusMessageForAddFriendAction());
    await runFriendMutation(
      () => bridge?.addFriend?.(friendEmail),
      "已添加好友。",
      (result) => {
        setFriendEmail(nextFriendEmailDraftAfterAddFriendAction(friendEmail, result));
        return statusMessageForAddFriendAction(result);
      },
      () => statusMessageForAddFriendError()
    );
  };

  const recallSyncedPet = async (pet: DesktopSyncedPetCard) => {
    if (!canRunFriendMutation(account, isMutatingFriend)) {
      return;
    }

    setStatusMessage(pendingStatusMessageForRecallAction(pet.name));
    await runFriendMutation(
      () => bridge?.recallPet?.(pet.id),
      statusMessageForRecallAction(pet.name)
    );
  };

  const requestFriendHosting = async (friend: DesktopFriendCard) => {
    if (
      !selectedSyncedPet ||
      !canRequestFriendHosting(account, selectedSyncedPet, isMutatingFriend)
    ) {
      return;
    }

    setStatusMessage(pendingStatusMessageForHostingRequestAction(friend.name));
    await runFriendMutation(
      () => bridge?.requestHosting?.(selectedSyncedPet.id, friend.id),
      statusMessageForHostingRequestAction(friend.name, selectedSyncedPet.name)
    );
  };

  const removeFriend = async (friend: DesktopFriendCard) => {
    if (!canRunFriendMutation(account, isMutatingFriend)) {
      return;
    }

    setStatusMessage(pendingStatusMessageForRemoveFriendAction(friend.name));
    await runFriendMutation(
      () => bridge?.removeFriend?.(friend.id),
      statusMessageForRemoveFriendAction(friend.name)
    );
  };

  return (
    <main className="studio-app">
      <section className="studio-topbar">
        <div>
          <h1>{accountDisplayName(account)}</h1>
          <p>{accountDetail(account)}</p>
        </div>
        <div className="studio-topbar-actions">
          {account ? (
            <button
              onClick={() =>
                void runAction(
                  () => bridge?.signOut?.(),
                  statusMessageForSignOutAction(),
                  (result) => setFriendEmail(nextFriendEmailDraftAfterSignOutAction(friendEmail, result))
                )
              }
            >
              退出
            </button>
          ) : null}
          <button
            onClick={() => void syncDesktopBundle()}
            disabled={!canSyncDesktopBundle(account, isSyncingDesktopBundle)}
          >
            同步
          </button>
        </div>
      </section>

      {!account ? (
        <section className="studio-panel login-panel">
          <h2>{loginPanelTitle()}</h2>
          <p>{loginPanelDetail()}</p>
          <label>
            邮箱
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密码
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          <button
            className="primary-action"
            disabled={!canSubmitLogin(email, password, isLoggingIn)}
            onClick={() => void signIn()}
          >
            登录
          </button>
        </section>
      ) : null}

      <section className="studio-grid">
        <div className="studio-panel">
          <div className="panel-heading">
            <h2>桌面宠物</h2>
            <span>{displayedPetCount} 只</span>
          </div>
          <div className="segmented-row">
            {displayedPetIndexes.map((index) => (
              <button
                key={index}
                className={index === selectedPetIndex ? "selected" : ""}
                onClick={() => {
                  setSelectedPetIndex(index);
                  setPreviewingMaterialSlot(undefined);
                  setPetNameDraft(petNameDraftForIndex(state, index));
                }}
              >
                {state.petNames[index] ?? `Pet ${index + 1}`}
              </button>
            ))}
          </div>
          <label>
            宠物名称
            <input value={petNameDraft} onChange={(event) => setPetNameDraft(event.target.value)} />
          </label>
          <div className="field-group">
            <span>宠物大小</span>
            <div className="segmented-row">
              {studioPetSizeOptions().map((option) => {
                const currentScale = state.petSizeScales[selectedPetIndex] ?? 1;
                return (
                  <button
                    key={option.scale}
                    className={isSelectedStudioPetSize(option.scale, currentScale) ? "selected" : ""}
                    onClick={() =>
                      void runAction(
                        () => bridge?.setPetSize?.(selectedPetIndex, option.scale),
                        "已调整宠物大小。"
                      )
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="button-grid">
            <button onClick={() => void runAction(() => bridge?.addPet?.(), "已添加宠物。")}>添加宠物</button>
            <button
              disabled={displayedPetCount <= 0}
              onClick={() =>
                void runAction(() => bridge?.removePet?.(selectedPetIndex), "已删除宠物。")
              }
            >
              删除宠物
            </button>
            <button
              onClick={() =>
                void runAction(
                  () => bridge?.renamePet?.(selectedPetIndex, petNameDraft),
                  "已更新宠物名称。"
                )
              }
            >
              保存名称
            </button>
            <button onClick={() => void runAction(() => bridge?.showPets?.(), "已显示宠物。")}>
              显示
            </button>
            <button onClick={() => void runAction(() => bridge?.hidePets?.(), "已隐藏宠物。")}>
              隐藏
            </button>
            <button
              onClick={() =>
                void runAction(() => bridge?.toggleClickThrough?.(), "已切换点击穿透。")
              }
            >
              {state.isClickThrough ? "关闭穿透" : "开启穿透"}
            </button>
            <button
              onClick={() =>
                void runAction(() => bridge?.toggleMouseoverCatch?.(), "已切换鼠标抓虫。")
              }
            >
              {state.isMouseoverCatchEnabled ? "关闭抓虫" : "开启抓虫"}
            </button>
            <button onClick={() => void runAction(() => bridge?.resetPositions?.(), "已重置位置。")}>
              重置位置
            </button>
          </div>
        </div>

        <div className="studio-panel">
          <div className="panel-heading">
            <h2>{syncedPetPanelTitle()}</h2>
            <span>{syncedPetPanelDetail(state.syncedPetCards.length)}</span>
          </div>
          <div className="synced-list">
            {state.syncedPetCards.length === 0 ? (
              <div className="empty-copy">
                <strong>{syncedPetPanelEmptyTitle()}</strong>
                <span>{syncedPetPanelEmptyDetail()}</span>
              </div>
            ) : (
              state.syncedPetCards.map((pet) => {
                const isSelected = pet.id === selectedSyncedPet?.id;
                const cardAction = syncedPetCardAction(pet, isSelected);

                return (
                  <div className={`synced-card ${isSelected ? "selected" : ""}`} key={pet.id}>
                    <div>
                      <span>{pet.name}</span>
                      <small>
                        {pet.petNumber} · {statusTextForSyncedPet(pet)} · {pet.materialCount} 个素材
                      </small>
                    </div>
                    {cardAction ? (
                      <button
                        disabled={
                          cardAction.type === "recall" &&
                          !canRunFriendMutation(account, isMutatingFriend)
                        }
                        onClick={() => {
                          if (cardAction.type === "select") {
                            setSelectedSyncedPetID(pet.id);
                            void bridge?.selectSyncedPet?.(pet.id);
                            return;
                          }

                          void recallSyncedPet(pet);
                        }}
                      >
                        {cardAction.label}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="studio-panel">
          <div className="panel-heading">
            <h2>{friendPanelTitle()}</h2>
            <span>{friendPanelDetail(state.friendCards.length)}</span>
          </div>
          <label>
            好友邮箱
            <input
              value={friendEmail}
              onChange={(event) => setFriendEmail(event.target.value)}
              onKeyDown={(event) => {
                if (shouldSubmitFriendEmailKey(event.key)) {
                  event.preventDefault();
                  void submitFriendEmail();
                }
              }}
              placeholder={friendEmailInputPlaceholder()}
            />
          </label>
          <div className="button-grid">
            <button
              disabled={!canRefreshFriends(account, isRefreshingFriends)}
              onClick={() => void refreshFriends()}
            >
              刷新好友
            </button>
            <button
              disabled={!canSubmitFriendEmail(account, friendEmail, isMutatingFriend)}
              onClick={() => void submitFriendEmail()}
            >
              添加好友
            </button>
          </div>
          <div className="friend-list">
            {state.friendCards.length === 0 ? (
              <div className="empty-copy">
                <strong>{friendPanelEmptyTitle()}</strong>
                <span>{friendPanelEmptyDetail()}</span>
              </div>
            ) : (
              state.friendCards.map((friend) => (
                <div className="friend-row" key={friend.id}>
                  <div>
                    <span>{friend.name}</span>
                    <small>
                      {friendHostingDetail(friend)}
                    </small>
                  </div>
                  <div>
                    <button
                      disabled={!canRequestFriendHosting(account, selectedSyncedPet, isMutatingFriend)}
                      onClick={() => void requestFriendHosting(friend)}
                    >
                      寄养
                    </button>
                    <button
                      disabled={!canRunFriendMutation(account, isMutatingFriend)}
                      onClick={() => void removeFriend(friend)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="studio-panel material-panel">
        <div className="panel-heading">
          <div>
            <h2>{localMaterialBoardTitle()}</h2>
            <p>{localMaterialBoardDetail()}</p>
          </div>
          <span>Pet {selectedPetIndex + 1}</span>
        </div>
        <div className="material-groups">
          {groupedSlots.map(([group, slots]) => {
            const selectedLocalVideoSlots = state.localVideoSlots[selectedPetIndex] ?? [];
            const selectedLocalVideoPaths = state.localVideoPaths[selectedPetIndex] ?? {};
            const completedSlots = slots.filter((slot) => selectedLocalVideoSlots.includes(slot)).length;

            return (
              <section className="material-group" key={group}>
                <div className="material-group-heading">
                  <div>
                    <h3>{materialGroupTitle(group)}</h3>
                    <p>{materialGroupDescription(group)}</p>
                  </div>
                  <span>
                    {completedSlots}/{slots.length}
                  </span>
                </div>
                <div className="material-list">
                  {slots.map((slot) => {
                    const hasVideo = selectedLocalVideoSlots.includes(slot);
                    const previewPath = selectedLocalVideoPaths[slot];
                    const previewKey = `${selectedPetIndex}:${slot}`;
                    const isPreviewing = previewingMaterialSlot === previewKey && Boolean(previewPath);
                    const previewAction = localMaterialPreviewAction({ hasVideo, isPreviewing });
                    const slotName = petActionSlotDisplayName(slot);
                    return (
                      <div className={`material-row ${isPreviewing ? "previewing" : ""}`} key={slot}>
                        <span className="material-summary">
                          {slotName}
                          <small>{petActionSlotTriggerDescription(slot)}</small>
                          <small>{localMaterialStatusText({ hasVideo })}</small>
                        </span>
                        <div className="material-actions">
                          <button
                            disabled={previewAction.disabled}
                            onClick={() =>
                              setPreviewingMaterialSlot(isPreviewing ? undefined : previewKey)
                            }
                          >
                            {previewAction.label}
                          </button>
                          <button
                            onClick={() => {
                              setPreviewingMaterialSlot(undefined);
                              setStatusMessage(pendingStatusMessageForImportVideoAction(slotName));
                              void runAction(
                                () => bridge?.importVideo?.(selectedPetIndex, slot),
                                `已导入「${slotName}」。`,
                                (result) => statusMessageForImportVideoAction(slotName, result)
                              );
                            }}
                          >
                            导入
                          </button>
                          <button
                            disabled={!hasVideo}
                            onClick={() => {
                              setPreviewingMaterialSlot(undefined);
                              void runAction(
                                () => bridge?.removeVideo?.(selectedPetIndex, slot),
                                statusMessageForRemoveVideoAction(slotName)
                              );
                            }}
                          >
                            删除
                          </button>
                        </div>
                        {isPreviewing && previewPath ? (
                          <div className="material-preview">
                            <video autoPlay loop muted playsInline src={toVideoSource(previewPath)} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {statusMessage ? <p className="status-line">{statusMessage}</p> : null}
    </main>
  );
}
