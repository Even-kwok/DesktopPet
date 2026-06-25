import { useEffect, useState } from "react";
import type { PetActionSlot } from "../../shared/pet-action-slots.ts";
import type { DesktopAccountSession, DesktopSyncedPetCard } from "../../shared/settings-store.ts";
import type { DesktopPetBridge } from "../../preload/index.ts";
import {
  accountDetail,
  accountDisplayName,
  canSubmitLogin,
  canSyncDesktopBundle,
  loginPanelDetail,
  loginPanelTitle,
  loginValidationMessage,
  syncedPetCardAction,
  syncedPetPanelDetail,
  syncedPetPanelEmptyDetail,
  syncedPetPanelEmptyTitle,
  syncedPetPanelTitle,
  statusTextForSyncedPet
} from "../../shared/studio-model.ts";
import {
  pendingStatusMessageForSignInAction,
  pendingStatusMessageForSyncAction,
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
  appVersion?: string;
  account?: DesktopAccountSession;
  petCount: number;
  petNames: string[];
  selectedSyncedPetID?: string;
  syncedPetCards: DesktopSyncedPetCard[];
  localVideoSlots: PetActionSlot[][];
  localVideoPaths: Partial<Record<PetActionSlot, string>>[];
  petSizeScales: number[];
  isPetVisible: boolean;
  isClickThrough: boolean;
  isMouseoverCatchEnabled: boolean;
};

const defaultStudioState: StudioState = {
  appVersion: undefined,
  account: undefined,
  petCount: 1,
  petNames: ["Pet 1"],
  selectedSyncedPetID: undefined,
  syncedPetCards: [],
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
  const [isSyncingDesktopBundle, setIsSyncingDesktopBundle] = useState(false);
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

  return (
    <main className="studio-app">
      <section className="studio-topbar">
        <div>
          <div className="studio-title-row">
            <h1>{accountDisplayName(account)}</h1>
            {state.appVersion ? <span className="version-badge">v{state.appVersion}</span> : null}
          </div>
          <p>{accountDetail(account)}</p>
        </div>
        <div className="studio-topbar-actions">
          {account ? (
            <button
              onClick={() =>
                void runAction(
                  () => bridge?.signOut?.(),
                  statusMessageForSignOutAction()
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

      <section className="studio-grid">
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
                    <div className="synced-pet-summary">
                      {pet.avatarUrl ? (
                        <img
                          alt=""
                          className="synced-pet-avatar"
                          loading="lazy"
                          src={pet.avatarUrl}
                        />
                      ) : (
                        <div aria-hidden="true" className="synced-pet-avatar placeholder">
                          {pet.name.trim().slice(0, 1) || "猫"}
                        </div>
                      )}
                      <div>
                        <span>{pet.name}</span>
                        <small>
                          {pet.petNumber} · {statusTextForSyncedPet(pet)} · {pet.materialCount} 个素材
                        </small>
                      </div>
                    </div>
                    {cardAction ? (
                      <button
                        onClick={() => {
                          if (cardAction.type === "select") {
                            setSelectedSyncedPetID(pet.id);
                            void bridge?.selectSyncedPet?.(pet.id);
                          }
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
