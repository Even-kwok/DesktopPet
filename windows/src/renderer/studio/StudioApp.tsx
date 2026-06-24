import { useEffect, useState } from "react";
import type { PetActionSlot } from "../../shared/pet-action-slots.ts";
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
  friendEmailValidationMessage,
  friendHostingDetail,
  friendPanelDetail,
  friendPanelEmptyDetail,
  friendPanelEmptyTitle,
  friendPanelTitle,
  loginPanelDetail,
  loginPanelTitle,
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
  pendingStatusMessageForRecallAction,
  pendingStatusMessageForRemoveFriendAction,
  pendingStatusMessageForSignInAction,
  pendingStatusMessageForSyncAction,
  statusMessageForAddFriendAction,
  statusMessageForAddFriendError,
  statusMessageForRemoveFriendAction,
  statusMessageForRefreshFriendsAction,
  statusMessageForHostingRequestAction,
  statusMessageForRecallAction,
  statusMessageForSignInAction,
  statusMessageForSignOutAction,
  statusMessageForSyncAction
} from "./studio-action-result.ts";
import {
  nextSelectedSyncedPetID,
} from "./studio-selection.ts";
import { runStudioAction } from "./studio-action-runner.ts";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [isSyncingDesktopBundle, setIsSyncingDesktopBundle] = useState(false);
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  const [isMutatingFriend, setIsMutatingFriend] = useState(false);
  const [selectedSyncedPetID, setSelectedSyncedPetID] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState("");

  const bridge = window.desktopPet;

  const refreshState = async () => {
    const nextState = (await bridge?.getStudioState?.()) as StudioState | undefined;
    if (nextState) {
      const mergedState = { ...defaultStudioState, ...nextState };
      setState(mergedState);
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
      void refreshState();
    });
  }, [bridge]);

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

  const signIn = async () => {
    if (!canSubmitLogin(email, password, isLoggingIn)) {
      return;
    }

    const validationMessage = loginValidationMessage(email, password);
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    const trimmedEmail = email.trim();
    setStatusMessage(pendingStatusMessageForSignInAction());
    setIsLoggingIn(true);
    try {
      await runAction(() => {
        if (!bridge?.signIn) {
          throw new Error("桌面登录服务未就绪，请重新打开素材工作台。");
        }

        return bridge.signIn(trimmedEmail, password);
      }, statusMessageForSignInAction());
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
    if (isMutatingFriend) {
      return;
    }

    const validationMessage = friendEmailValidationMessage(account, friendEmail);
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

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
        <form
          className="studio-panel login-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <h2>{loginPanelTitle()}</h2>
          <p>{loginPanelDetail()}</p>
          <label>
            邮箱
            <input
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          <button
            className="primary-action"
            disabled={!canSubmitLogin(email, password, isLoggingIn)}
            type="submit"
          >
            {isLoggingIn ? "登录中..." : "登录"}
          </button>
        </form>
      ) : null}

      {statusMessage ? (
        <p className="status-line" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      <section className="studio-stack">
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
      </section>

    </main>
  );
}
