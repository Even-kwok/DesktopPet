import { useEffect, useMemo, useState } from "react";
import {
  allPetActionSlots,
  materialGroupForSlot,
  petActionSlotDisplayName
} from "../../shared/pet-action-slots.ts";
import type { PetActionSlot, PetMaterialGroup } from "../../shared/pet-action-slots.ts";
import type { DesktopFriendCard } from "../../shared/desktop-sync-client.ts";
import type { DesktopAccountSession, DesktopSyncedPetCard } from "../../shared/settings-store.ts";
import type { DesktopPetBridge } from "../../preload/index.ts";
import {
  canRequestHosting,
  friendHostingDetail,
  shouldShowRecallAction,
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
  statusMessageForSyncAction,
  statusMessageForActionResult
} from "./studio-action-result.ts";
import {
  nextSelectedPetIndexAfterStudioRefresh,
  nextSelectedSyncedPetID,
  petNameDraftForIndex,
  studioPetCountForDisplay,
  studioPetIndexesForDisplay
} from "./studio-selection.ts";
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
  petSizeScales: [1],
  isPetVisible: false,
  isClickThrough: false,
  isMouseoverCatchEnabled: true
};

const materialGroupTitles: Record<PetMaterialGroup, string> = {
  core: "基础状态",
  pointer: "鼠标触发",
  nearbyPet: "宠物靠近互动",
  idleLife: "待机生活动作",
  feeding: "喂食 / 条件动作",
  reserved: "备用动作"
};

export function StudioApp() {
  const [state, setState] = useState<StudioState>(defaultStudioState);
  const [email, setEmail] = useState("demo@desktop.pet");
  const [password, setPassword] = useState("123456");
  const [selectedPetIndex, setSelectedPetIndex] = useState(0);
  const [petNameDraft, setPetNameDraft] = useState("Pet 1");
  const [friendEmail, setFriendEmail] = useState("");
  const [selectedSyncedPetID, setSelectedSyncedPetID] = useState<string | undefined>();
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
    try {
      const result = await action();
      await refreshState(result);
      const nextStatusMessage = afterSuccess?.(result);
      setStatusMessage(nextStatusMessage ?? statusMessageForActionResult(result, successMessage));
    } catch (error) {
      const nextStatusMessage = afterError?.(error);
      setStatusMessage(
        nextStatusMessage ?? (error instanceof Error ? error.message : "操作失败，请稍后重试。")
      );
    }
  };

  const account = state.account;
  const selectedSyncedPet =
    state.syncedPetCards.find((pet) => pet.id === selectedSyncedPetID) ?? state.syncedPetCards[0];
  const displayedPetCount = studioPetCountForDisplay(state.petCount);
  const displayedPetIndexes = studioPetIndexesForDisplay(state.petCount);

  return (
    <main className="studio-app">
      <section className="studio-topbar">
        <div>
          <h1>CatDesktopPet</h1>
          <p>{account ? `${account.email} · ${account.credits} 积分` : "登录后同步网页端猫咪素材"}</p>
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
            onClick={() => {
              setStatusMessage(pendingStatusMessageForSyncAction());
              void runAction(
                () => bridge?.sync?.(),
                "已同步网页端素材。",
                (result) => statusMessageForSyncAction(result)
              );
            }}
            disabled={!account}
          >
            同步
          </button>
        </div>
      </section>

      {!account ? (
        <section className="studio-panel login-panel">
          <h2>登录账号</h2>
          <p>Windows 端负责显示、同步、好友寄养和召回；素材生成继续在网页端完成。</p>
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
            onClick={() => {
              setStatusMessage(pendingStatusMessageForSignInAction());
              void runAction(() => bridge?.signIn?.(email, password), statusMessageForSignInAction());
            }}
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
            <h2>同步宠物</h2>
            <span>{state.syncedPetCards.length} 只</span>
          </div>
          <div className="synced-list">
            {state.syncedPetCards.length === 0 ? (
              <p className="empty-copy">同步后这里会显示网页端可下发到桌面的猫咪。</p>
            ) : (
              state.syncedPetCards.map((pet) => (
                <button
                  className={`synced-card ${pet.id === selectedSyncedPet?.id ? "selected" : ""}`}
                  key={pet.id}
                  onClick={() => {
                    setSelectedSyncedPetID(pet.id);
                    void bridge?.selectSyncedPet?.(pet.id);
                  }}
                >
                  <span>{pet.name}</span>
                  <small>
                    {pet.petNumber} · {statusTextForSyncedPet(pet)} · {pet.materialCount} 个素材
                  </small>
                </button>
              ))
            )}
          </div>
          <div className="button-grid">
            <button
              disabled={!account || !selectedSyncedPet || !shouldShowRecallAction(selectedSyncedPet, true)}
              onClick={() => {
                if (selectedSyncedPet) {
                  setStatusMessage(pendingStatusMessageForRecallAction(selectedSyncedPet.name));
                }
                void runAction(
                  () => bridge?.recallPet?.(selectedSyncedPet?.id ?? ""),
                  selectedSyncedPet ? statusMessageForRecallAction(selectedSyncedPet.name) : "已发送召回请求。"
                );
              }}
            >
              召回选中宠物
            </button>
          </div>
        </div>

        <div className="studio-panel">
          <div className="panel-heading">
            <h2>好友寄养</h2>
            <span>{state.friendCards.length} 位</span>
          </div>
          <label>
            好友邮箱
            <input value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} />
          </label>
          <div className="button-grid">
            <button
              disabled={!account}
              onClick={() =>
                void runAction(
                  () => bridge?.refreshFriends?.(),
                  "好友列表已刷新。",
                  (result) => statusMessageForRefreshFriendsAction(result)
                )
              }
            >
              刷新好友
            </button>
            <button
              disabled={!account || !friendEmail.trim()}
              onClick={() => {
                setStatusMessage(pendingStatusMessageForAddFriendAction());
                void runAction(
                  () => bridge?.addFriend?.(friendEmail),
                  "已添加好友。",
                  (result) => {
                    setFriendEmail(nextFriendEmailDraftAfterAddFriendAction(friendEmail, result));
                    return statusMessageForAddFriendAction(result);
                  },
                  () => statusMessageForAddFriendError()
                );
              }}
            >
              添加好友
            </button>
          </div>
          <div className="friend-list">
            {state.friendCards.length === 0 ? (
              <p className="empty-copy">暂无好友。添加好友后可以把选中的猫咪寄养过去。</p>
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
                      disabled={!account || !selectedSyncedPet || !canRequestHosting(selectedSyncedPet)}
                      onClick={() => {
                        setStatusMessage(pendingStatusMessageForHostingRequestAction(friend.name));
                        void runAction(
                          () => bridge?.requestHosting?.(selectedSyncedPet?.id ?? "", friend.id),
                          selectedSyncedPet
                            ? statusMessageForHostingRequestAction(friend.name, selectedSyncedPet.name)
                            : `已向 ${friend.name} 发起寄养。`
                        );
                      }}
                    >
                      寄养
                    </button>
                    <button
                      disabled={!account}
                      onClick={() => {
                        setStatusMessage(pendingStatusMessageForRemoveFriendAction(friend.name));
                        void runAction(
                          () => bridge?.removeFriend?.(friend.id),
                          statusMessageForRemoveFriendAction(friend.name)
                        );
                      }}
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
          <h2>状态视频</h2>
          <span>Pet {selectedPetIndex + 1}</span>
        </div>
        <div className="material-groups">
          {groupedSlots.map(([group, slots]) => (
            <section className="material-group" key={group}>
              <h3>{materialGroupTitles[group]}</h3>
              <div className="material-list">
                {slots.map((slot) => {
                  const hasVideo = state.localVideoSlots[selectedPetIndex]?.includes(slot) ?? false;
                  const slotName = petActionSlotDisplayName(slot);
                  return (
                    <div className="material-row" key={slot}>
                      <span>
                        {slotName}
                        <small>{hasVideo ? "已导入" : "未设置"}</small>
                      </span>
                      <div>
                        <button
                          onClick={() => {
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
                          onClick={() =>
                            void runAction(
                              () => bridge?.removeVideo?.(selectedPetIndex, slot),
                              statusMessageForRemoveVideoAction(slotName)
                            )
                          }
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      {statusMessage ? <p className="status-line">{statusMessage}</p> : null}
    </main>
  );
}
