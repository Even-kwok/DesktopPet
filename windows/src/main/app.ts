import { app, dialog, ipcMain, Menu, nativeImage, powerMonitor, Tray } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PetColonyController } from "./pet-colony-controller.ts";
import { PetWindowController } from "./pet-window-controller.ts";
import { StudioWindowController } from "./studio-window-controller.ts";
import { registerIpcHandlers } from "./ipc.ts";
import {
  existingInstanceReopenActions,
  initialLaunchActions,
  singleInstanceStartupPlan,
  systemWakeActions
} from "./app-lifecycle-policy.ts";
import {
  bindMenuActions,
  buildTrayMenuTemplate,
  resetPositionsActionPlan
} from "./tray-controller.ts";
import { studioCommandFromPetPayload } from "./studio-window-policy.ts";
import {
  firstRunIdleLoopPromptOptions,
  firstRunIdleLoopPromptPlan,
  idleLoopImportTargetAfterAddingPet,
  isSupportedLocalVideoPath,
  localVideoPickerOptions,
  localVideoRemovalAction,
  petCountAfterLocalVideoImport
} from "./local-import-policy.ts";
import { showPetsActionPlan } from "./pet-visibility-policy.ts";
import { probeLocalVideoMetadata } from "./local-video-metadata.ts";
import { resolveRuntimePaths } from "./runtime-paths.ts";
import {
  refreshedFriendCardsAfterSync,
  replacementWarningDialogOptions
} from "./sync-policy.ts";
import { importDesktopBundle } from "./desktop-bundle-importer.ts";
import { createSingleFlightActionGroup } from "./studio-action-guard.ts";
import {
  refreshedAccountSessionFromSyncAccount,
  SettingsStore
} from "../shared/settings-store.ts";
import { SleepRecoveryCoordinator } from "../shared/sleep-recovery-coordinator.ts";
import {
  DesktopPetSyncClient,
  localMaterialReplacementDescriptions
} from "../shared/desktop-sync-client.ts";
import { allPetActionSlots, petActionSlotDisplayName } from "../shared/pet-action-slots.ts";
import {
  reviewPetVideoImport,
  unreadablePetVideoImportMessage
} from "../shared/video-import-review.ts";
import {
  resolveFriendRemovalTarget,
  resolveHostingRequestTarget,
  resolveRecallPetTarget
} from "../shared/studio-model.ts";
import type { PetActionSlot, VisiblePetActionSlot } from "../shared/pet-action-slots.ts";
import type { ExistingInstanceReopenAction } from "./app-lifecycle-policy.ts";

let studioWindowController: StudioWindowController | undefined;
let tray: Tray | undefined;
let runExistingInstanceReopenAction: (action: ExistingInstanceReopenAction) => void = () => {};

async function bootstrap() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const runtimePaths = resolveRuntimePaths(currentDir, process.env.ELECTRON_RENDERER_URL);
  const settingsStore = new SettingsStore(path.join(app.getPath("userData"), "settings.json"));
  const desktopSyncClient = new DesktopPetSyncClient(process.env.CAT_DESKTOP_PET_WEB_BASE_URL);
  const remoteMaterialRoot = path.join(app.getPath("appData"), "CatDesktopPet", "RemoteMaterials");
  const petColonyController = new PetColonyController(
    settingsStore,
    (petIndex) =>
      new PetWindowController(settingsStore, petIndex, {
        preloadPath: runtimePaths.preloadPath,
        petRendererURL: runtimePaths.petRendererURL,
        petRendererFile: runtimePaths.petRendererFile,
        getClickThrough: () => settingsStore.isClickThrough
      })
  );
  studioWindowController = new StudioWindowController({
    preloadPath: runtimePaths.preloadPath,
    studioRendererURL: runtimePaths.studioRendererURL,
    studioRendererFile: runtimePaths.studioRendererFile
  });
  const sleepRecoveryCoordinator = new SleepRecoveryCoordinator(
    () => petColonyController.prepareForSystemSleep(),
    () => systemWakeActions().forEach((action) => runExistingInstanceReopenAction(action))
  );
  const signInActions = createSingleFlightActionGroup();
  const syncActions = createSingleFlightActionGroup();
  const refreshFriendActions = createSingleFlightActionGroup();
  const mutateFriendActions = createSingleFlightActionGroup();
  let refreshTray = () => {};
  runExistingInstanceReopenAction = (action) => {
    switch (action) {
      case "resumePets":
        petColonyController.resumeAfterSystemWake();
        return;
      case "showStudio":
        studioWindowController?.show();
        return;
      case "refreshTray":
        refreshTray();
    }
  };
  const studioState = () => ({
    account: settingsStore.currentAccount,
    petCount: settingsStore.petCount,
    petNames: Array.from({ length: settingsStore.petCount }, (_, index) => settingsStore.petName(index)),
    selectedSyncedPetID: settingsStore.selectedSyncedPetID,
    syncedPetCards: settingsStore.syncedPetCards,
    friendCards: settingsStore.friendCards,
    localVideoSlots: Array.from({ length: settingsStore.petCount }, (_, index) =>
      settingsStore.availableVideoSlots(index)
    ),
    petSizeScales: Array.from({ length: settingsStore.petCount }, (_, index) => settingsStore.petSizeScale(index)),
    isPetVisible: settingsStore.isPetVisible,
    isClickThrough: settingsStore.isClickThrough,
    isMouseoverCatchEnabled: settingsStore.isMouseoverCatchEnabled
  });

  registerIpcHandlers(ipcMain, {
    getStudioState: studioState,
    signIn: (email, password) => signInActions.run(async () => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        throw new Error("请输入邮箱和密码。");
      }

      const response = await desktopSyncClient.login(trimmedEmail, password);
      settingsStore.saveAccountSession({
        id: response.account.id,
        name: response.account.name,
        email: response.account.email,
        credits: response.account.credits,
        accessToken: response.accessToken,
        signedInAt: new Date().toISOString()
      });

      try {
        settingsStore.saveFriendCards(await desktopSyncClient.fetchFriends(response.accessToken));
      } catch {
        settingsStore.clearFriendCards();
      }

      return studioState();
    }),
    signOut: () => {
      settingsStore.signOut();
      settingsStore.clearFriendCards();
      return studioState();
    },
    sync: () => syncActions.run(async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const bundle = await desktopSyncClient.fetchBundle(account.accessToken);
      const replacements = localMaterialReplacementDescriptions(bundle, (slot, petIndex) =>
        settingsStore.restoreVideoPath(slot, petIndex)
      );

      if (replacements.length > 0) {
        const response = await dialog.showMessageBox(replacementWarningDialogOptions(replacements));

        if (response.response === 1) {
          return { canceled: true, ...studioState() };
        }
      }

      const refreshedAccount = refreshedAccountSessionFromSyncAccount(account, bundle.account);
      settingsStore.saveAccountSession(refreshedAccount);
      settingsStore.saveFriendCards(
        await refreshedFriendCardsAfterSync(
          refreshedAccount.accessToken,
          settingsStore.friendCards,
          (accessToken) => desktopSyncClient.fetchFriends(accessToken)
        )
      );
      const summary = await importDesktopBundle(bundle, {
        settingsStore,
        petColonyController,
        remoteMaterialRoot
      });
      refreshTray();
      return { summary, ...studioState() };
    }),
    selectSyncedPet: (petId) => {
      if (settingsStore.syncedPetCards.some((pet) => pet.id === petId)) {
        settingsStore.selectedSyncedPetID = petId;
      }
      return studioState();
    },
    addPet: () => {
      const petIndex = petColonyController.addPet();
      refreshTray();
      return { petIndex, ...studioState() };
    },
    removePet: (petIndex) => {
      settingsStore.isPetVisible = settingsStore.isPetVisible && petColonyController.removePet(petIndex);
      refreshTray();
      return studioState();
    },
    renamePet: (petIndex, name) => {
      settingsStore.setPetName(name, petIndex);
      petColonyController.refreshDisplayNames();
      refreshTray();
      return studioState();
    },
    importVideo: async (petIndex, slot) => {
      const result = await importLocalVideo({
        petIndex,
        slot: toPetActionSlot(slot),
        settingsStore,
        petColonyController
      });
      refreshTray();
      return { result, ...studioState() };
    },
    removeVideo: (petIndex, slot) => {
      const videoSlot = toPetActionSlot(slot);
      const removalAction = localVideoRemovalAction(videoSlot, settingsStore.isPetVisible);
      settingsStore.removeVideo(videoSlot, petIndex);
      if (removalAction === "showAll") {
        settingsStore.isPetVisible = petColonyController.showAll();
      } else {
        petColonyController.refreshPlayback();
      }
      refreshTray();
      return studioState();
    },
    setPetSize: (petIndex, scale) => {
      petColonyController.setPetSizeScale(scale, petIndex);
      refreshTray();
      return studioState();
    },
    showPets: async () => {
      const visibilityResult = showPetsActionPlan(petColonyController.showAll());
      settingsStore.isPetVisible = visibilityResult.isPetVisible;
      let result: unknown;
      if (visibilityResult.importIdleLoop) {
        result = await importLocalVideo({
          petIndex: visibilityResult.petIndex,
          slot: visibilityResult.slot,
          settingsStore,
          petColonyController
        });
      }
      refreshTray();
      return { result, didShow: settingsStore.isPetVisible, ...studioState() };
    },
    hidePets: () => {
      settingsStore.isPetVisible = false;
      petColonyController.hideAll();
      refreshTray();
      return studioState();
    },
    toggleClickThrough: () => {
      settingsStore.isClickThrough = !settingsStore.isClickThrough;
      petColonyController.setClickThrough(settingsStore.isClickThrough);
      refreshTray();
      return studioState();
    },
    toggleMouseoverCatch: () => {
      settingsStore.isMouseoverCatchEnabled = !settingsStore.isMouseoverCatchEnabled;
      petColonyController.refreshPlayback();
      refreshTray();
      return studioState();
    },
    resetPositions: () => {
      petColonyController.resetPositions();
      if (resetPositionsActionPlan().refreshTray) {
        refreshTray();
      }
      return studioState();
    },
    refreshFriends: () => refreshFriendActions.run(async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const friends = await desktopSyncClient.fetchFriends(account.accessToken);
      settingsStore.saveFriendCards(friends);
      return studioState();
    }),
    addFriend: (email) => mutateFriendActions.run(async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        throw new Error("请输入好友邮箱。");
      }
      const addedFriend = await desktopSyncClient.addFriend(trimmedEmail, account.accessToken);
      settingsStore.upsertFriendCard(addedFriend);
      return { addedFriend, ...studioState() };
    }),
    removeFriend: (friendId) => mutateFriendActions.run(async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const target = resolveFriendRemovalTarget(friendId, settingsStore.friendCards);
      await desktopSyncClient.removeFriend(target.friendId, account.accessToken);
      settingsStore.removeFriendCard(target.friendId);
      return studioState();
    }),
    requestHosting: (petId, toUserId) => mutateFriendActions.run(async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const target = resolveHostingRequestTarget(
        petId,
        toUserId,
        settingsStore.syncedPetCards,
        settingsStore.friendCards
      );
      await desktopSyncClient.requestHosting(target.petId, target.toUserId, account.accessToken);
      return studioState();
    }),
    recallPet: (petId) => mutateFriendActions.run(async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const target = resolveRecallPetTarget(petId, settingsStore.syncedPetCards);
      await desktopSyncClient.recallPet(target.petId, account.accessToken);
      settingsStore.markSyncedPetRecalled(target.petId);
      return studioState();
    }),
    petDragStarted: (petIndex) => {
      petColonyController.dragPetStarted(petIndex);
    },
    petDragBy: (petIndex, delta) => {
      petColonyController.dragPetBy(petIndex, delta);
    },
    petDragEnded: (petIndex) => {
      petColonyController.dragPetEnded(petIndex);
    },
    petClick: (petIndex) => {
      petColonyController.clickPet(petIndex);
    },
    petPlaybackEnded: (petIndex) => {
      petColonyController.petPlaybackEnded(petIndex);
    },
  });

  powerMonitor.on("suspend", () => sleepRecoveryCoordinator.systemWillSleep());
  powerMonitor.on("resume", () => sleepRecoveryCoordinator.systemDidWake());

  tray = new Tray(makeTrayIcon());
  tray.setToolTip("CatDesktopPet");
  refreshTray = () => {
    const template = buildTrayMenuTemplate({
      petCount: settingsStore.petCount,
      isVisible: petColonyController.isVisible,
      isClickThrough: settingsStore.isClickThrough,
      isMouseoverCatchEnabled: settingsStore.isMouseoverCatchEnabled,
      petName: (petIndex) => settingsStore.petName(petIndex),
      hasVideo: (slot, petIndex) => settingsStore.restoreVideoPath(slot, petIndex) !== undefined,
      petSizeScale: (petIndex) => settingsStore.petSizeScale(petIndex)
    });

    tray?.setContextMenu(
      Menu.buildFromTemplate(
        bindMenuActions(template, {
          openStudio: () => studioWindowController?.show(),
          chooseStateVideo: (payload) => {
            const record = payloadRecord(payload);
            void importLocalVideo({
              petIndex: Number(record.petIndex),
              slot: toPetActionSlot(String(record.slot ?? "")),
              settingsStore,
              petColonyController
            })
              .then(refreshTray)
              .catch(showActionError);
          },
          toggleVisibility: () => {
            if (petColonyController.isVisible) {
              settingsStore.isPetVisible = false;
              petColonyController.hideAll();
            } else {
              const visibilityResult = showPetsActionPlan(petColonyController.showAll());
              settingsStore.isPetVisible = visibilityResult.isPetVisible;
              if (visibilityResult.importIdleLoop) {
                void importLocalVideo({
                  petIndex: visibilityResult.petIndex,
                  slot: visibilityResult.slot,
                  settingsStore,
                  petColonyController
                })
                  .then(refreshTray)
                  .catch(showActionError);
              }
            }
            refreshTray();
          },
          toggleClickThrough: () => {
            settingsStore.isClickThrough = !settingsStore.isClickThrough;
            petColonyController.setClickThrough(settingsStore.isClickThrough);
            refreshTray();
          },
          toggleMouseoverCatch: () => {
            settingsStore.isMouseoverCatchEnabled = !settingsStore.isMouseoverCatchEnabled;
            petColonyController.refreshPlayback();
            refreshTray();
          },
          resetPositions: () => {
            petColonyController.resetPositions();
            if (resetPositionsActionPlan().refreshTray) {
              refreshTray();
            }
          },
          addPet: () => {
            const petIndex = petColonyController.addPet();
            refreshTray();
            void importLocalVideo({
              ...idleLoopImportTargetAfterAddingPet(petIndex),
              settingsStore,
              petColonyController
            })
              .then(refreshTray)
              .catch(showActionError);
          },
          renamePet: (payload) => studioWindowController?.show(studioCommandFromPetPayload(payload)),
          removePet: (payload) => {
            const petIndex = payloadPetIndex(payload);
            settingsStore.isPetVisible = settingsStore.isPetVisible && petColonyController.removePet(petIndex);
            refreshTray();
          },
          setPetSize: (payload) => {
            const record = payloadRecord(payload);
            petColonyController.setPetSizeScale(Number(record.scale), Number(record.petIndex));
            refreshTray();
          },
          removeStateVideo: (payload) => {
            const record = payloadRecord(payload);
            const videoSlot = toPetActionSlot(String(record.slot ?? ""));
            const removalAction = localVideoRemovalAction(videoSlot, settingsStore.isPetVisible);
            settingsStore.removeVideo(videoSlot, Number(record.petIndex));
            if (removalAction === "showAll") {
              settingsStore.isPetVisible = petColonyController.showAll();
            } else {
              petColonyController.refreshPlayback();
            }
            refreshTray();
          },
          quit: () => app.quit()
        }) as MenuItemConstructorOptions[]
      )
    );
  };
  refreshTray();

  let didRestoreVideo = false;
  if (settingsStore.isPetVisible) {
    didRestoreVideo = petColonyController.showAll();
    settingsStore.isPetVisible = didRestoreVideo;
    refreshTray();
  }

  const launchActions = initialLaunchActions();
  if (launchActions.showStudio) {
    studioWindowController.show();
  }

  const firstRunPrompt = firstRunIdleLoopPromptPlan({
    showsFirstRunPrompt: launchActions.showsFirstRunPrompt,
    didRestoreVideo,
    hasFirstPetIdleLoop: settingsStore.restoreVideoPath("idle_loop", 0) !== undefined
  });
  if (firstRunPrompt.shouldPrompt) {
    setTimeout(() => {
      void dialog
        .showMessageBox(firstRunIdleLoopPromptOptions())
        .then((response) => {
          if (response.response !== 0) {
            return undefined;
          }

          return importLocalVideo({
            petIndex: firstRunPrompt.petIndex,
            slot: firstRunPrompt.slot,
            settingsStore,
            petColonyController
          }).then(refreshTray);
        })
        .catch(showActionError);
    }, 400);
  }
}

const startupPlan = singleInstanceStartupPlan(app.requestSingleInstanceLock());
if (startupPlan.shouldQuit) {
  app.quit();
} else {
  app.on("second-instance", handleExistingInstanceReopen);
  app.on("activate", handleExistingInstanceReopen);
  app.whenReady().then(bootstrap);
}

app.on("window-all-closed", () => {});

function handleExistingInstanceReopen() {
  existingInstanceReopenActions().forEach((action) => runExistingInstanceReopenAction(action));
}

function requireAccount<T extends { accessToken: string } | undefined>(account: T) {
  if (!account) {
    throw new Error("请先登录账号。");
  }

  return account;
}

async function importLocalVideo(input: {
  petIndex: number;
  slot: PetActionSlot;
  settingsStore: SettingsStore;
  petColonyController: PetColonyController;
}) {
  const result = await dialog.showOpenDialog(
    localVideoPickerOptions(
      input.settingsStore.petName(input.petIndex),
      petActionSlotDisplayName(input.slot)
    )
  );

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const videoPath = result.filePaths[0];
  let fileStats: Awaited<ReturnType<typeof stat>>;
  let videoMetadata: Awaited<ReturnType<typeof probeLocalVideoMetadata>>;
  try {
    fileStats = await stat(videoPath);
    videoMetadata = await probeLocalVideoMetadata(videoPath);
  } catch {
    throw new Error(unreadablePetVideoImportMessage);
  }

  if (videoMetadata.readError) {
    throw new Error(unreadablePetVideoImportMessage);
  }

  const review = reviewPetVideoImport({
    fileSizeBytes: fileStats.size,
    durationSeconds: videoMetadata.durationSeconds,
    hasVideoTrack: videoMetadata.hasVideoTrack && isSupportedLocalVideoPath(videoPath)
  });

  if (!review.canImport) {
    throw new Error(review.blockingMessages.join("\n"));
  }

  if (review.warningMessages.length > 0) {
    const response = await dialog.showMessageBox({
      type: "warning",
      buttons: ["继续导入", "取消"],
      defaultId: 0,
      cancelId: 1,
      title: "视频可能不够轻量",
      message: "这段视频可以导入，但可能影响桌宠表现。",
      detail: review.warningMessages.join("\n")
    });

    if (response.response === 1) {
      return { canceled: true };
    }
  }

  const nextPetCount = petCountAfterLocalVideoImport(
    input.settingsStore.petCount,
    input.petIndex,
    input.slot
  );
  if (nextPetCount !== input.settingsStore.petCount) {
    input.petColonyController.setPetCount(nextPetCount);
  }

  input.settingsStore.saveVideoPath(videoPath, input.slot, input.petIndex);
  if (input.slot === "idle_loop") {
    input.settingsStore.isPetVisible = true;
    input.petColonyController.showAll();
  } else {
    input.petColonyController.refreshPlayback();
  }

  return { canceled: false, videoPath, warningMessages: review.warningMessages };
}

function payloadPetIndex(payload: unknown) {
  return Number(payloadRecord(payload).petIndex);
}

function payloadRecord(payload: unknown) {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function makeTrayIcon() {
  return nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='16'%20height='16'%20viewBox='0%200%2016%2016'%3E%3Ccircle%20cx='8'%20cy='8'%20r='7'%20fill='%232f7d68'/%3E%3Ctext%20x='8'%20y='11'%20font-size='9'%20text-anchor='middle'%20fill='white'%3EP%3C/text%3E%3C/svg%3E"
  );
}

function showActionError(error: unknown) {
  void dialog.showMessageBox({
    type: "error",
    title: "操作失败",
    message: error instanceof Error ? error.message : "操作失败，请稍后重试。"
  });
}

function toPetActionSlot(slot: string): PetActionSlot {
  if (!allPetActionSlots.includes(slot as VisiblePetActionSlot)) {
    throw new Error("未知的状态视频槽位。");
  }

  return slot as PetActionSlot;
}
