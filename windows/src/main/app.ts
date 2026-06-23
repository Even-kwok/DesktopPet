import { app, dialog, ipcMain, Menu, nativeImage, powerMonitor, Tray } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PetColonyController } from "./pet-colony-controller.ts";
import { PetWindowController } from "./pet-window-controller.ts";
import { StudioWindowController } from "./studio-window-controller.ts";
import { registerIpcHandlers } from "./ipc.ts";
import { bindMenuActions, buildTrayMenuTemplate } from "./tray-controller.ts";
import { probeLocalVideoMetadata } from "./local-video-metadata.ts";
import { SettingsStore } from "../shared/settings-store.ts";
import { SleepRecoveryCoordinator } from "../shared/sleep-recovery-coordinator.ts";
import {
  DesktopPetSyncClient,
  DesktopPetSyncError,
  displayablePets,
  localMaterialReplacementDescriptions,
  readyDesktopMaterials,
  safeRemoteMaterialPathComponent,
  syncedPetCardsFromBundle
} from "../shared/desktop-sync-client.ts";
import { allPetActionSlots } from "../shared/pet-action-slots.ts";
import { reviewPetVideoImport } from "../shared/video-import-review.ts";
import type { DesktopPetBundleMaterial } from "../shared/desktop-sync-client.ts";
import type { PetActionSlot, VisiblePetActionSlot } from "../shared/pet-action-slots.ts";

let studioWindowController: StudioWindowController | undefined;
let tray: Tray | undefined;

async function bootstrap() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const preloadPath = path.join(currentDir, "../preload/index.js");
  const rendererURL = process.env.ELECTRON_RENDERER_URL;
  const studioRendererFile = path.join(currentDir, "../renderer/index.html");
  const petRendererFile = path.join(currentDir, "../renderer/pet.html");
  const settingsStore = new SettingsStore(path.join(app.getPath("userData"), "settings.json"));
  const desktopSyncClient = new DesktopPetSyncClient(process.env.CAT_DESKTOP_PET_WEB_BASE_URL);
  const remoteMaterialRoot = path.join(app.getPath("appData"), "CatDesktopPet", "RemoteMaterials");
  const petColonyController = new PetColonyController(
    settingsStore,
    (petIndex) =>
      new PetWindowController(settingsStore, petIndex, {
        preloadPath,
        petRendererURL: rendererURL,
        petRendererFile,
        getClickThrough: () => settingsStore.isClickThrough
      })
  );
  studioWindowController = new StudioWindowController({
    preloadPath,
    studioRendererURL: rendererURL,
    studioRendererFile
  });
  const sleepRecoveryCoordinator = new SleepRecoveryCoordinator(
    () => petColonyController.prepareForSystemSleep(),
    () => petColonyController.resumeAfterSystemWake()
  );
  let refreshTray = () => {};
  const studioState = () => ({
    account: settingsStore.currentAccount,
    petCount: settingsStore.petCount,
    petNames: Array.from({ length: settingsStore.petCount }, (_, index) => settingsStore.petName(index)),
    selectedSyncedPetID: settingsStore.selectedSyncedPetID,
    syncedPetCards: settingsStore.syncedPetCards,
    friendCards: settingsStore.friendCards,
    localVideoSlots: Array.from({ length: settingsStore.petCount }, (_, index) => settingsStore.savedVideoSlots(index)),
    isPetVisible: settingsStore.isPetVisible,
    isClickThrough: settingsStore.isClickThrough,
    isMouseoverCatchEnabled: settingsStore.isMouseoverCatchEnabled
  });

  registerIpcHandlers(ipcMain, {
    getStudioState: studioState,
    signIn: async (email, password) => {
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
    },
    signOut: () => {
      settingsStore.signOut();
      settingsStore.clearFriendCards();
      return studioState();
    },
    sync: async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const bundle = await desktopSyncClient.fetchBundle(account.accessToken);
      const replacements = localMaterialReplacementDescriptions(bundle, (slot, petIndex) =>
        settingsStore.restoreVideoPath(slot, petIndex)
      );

      if (replacements.length > 0) {
        const response = await dialog.showMessageBox({
          type: "warning",
          buttons: ["继续同步", "取消"],
          defaultId: 0,
          cancelId: 1,
          title: "同步会替换本地素材",
          message: "网页端素材会替换这些本地导入的视频。",
          detail: replacements.join("\n")
        });

        if (response.response === 1) {
          return { canceled: true, ...studioState() };
        }
      }

      const summary = await importDesktopBundle(bundle, {
        settingsStore,
        petColonyController,
        remoteMaterialRoot
      });
      refreshTray();
      return { summary, ...studioState() };
    },
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
      settingsStore.removeVideo(toPetActionSlot(slot), petIndex);
      petColonyController.refreshPlayback();
      refreshTray();
      return studioState();
    },
    setPetSize: (petIndex, scale) => {
      petColonyController.setPetSizeScale(scale, petIndex);
      refreshTray();
      return studioState();
    },
    showPets: () => {
      settingsStore.isPetVisible = true;
      const didShow = petColonyController.showAll();
      refreshTray();
      return { didShow, ...studioState() };
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
      return studioState();
    },
    refreshFriends: async () => {
      const account = requireAccount(settingsStore.currentAccount);
      const friends = await desktopSyncClient.fetchFriends(account.accessToken);
      settingsStore.saveFriendCards(friends);
      return studioState();
    },
    addFriend: async (email) => {
      const account = requireAccount(settingsStore.currentAccount);
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        throw new Error("请输入好友邮箱。");
      }
      settingsStore.upsertFriendCard(await desktopSyncClient.addFriend(trimmedEmail, account.accessToken));
      return studioState();
    },
    removeFriend: async (friendId) => {
      const account = requireAccount(settingsStore.currentAccount);
      await desktopSyncClient.removeFriend(friendId, account.accessToken);
      settingsStore.removeFriendCard(friendId);
      return studioState();
    },
    requestHosting: async (petId, toUserId) => {
      const account = requireAccount(settingsStore.currentAccount);
      await desktopSyncClient.requestHosting(petId, toUserId, account.accessToken);
      return studioState();
    },
    recallPet: async (petId) => {
      const account = requireAccount(settingsStore.currentAccount);
      await desktopSyncClient.recallPet(petId, account.accessToken);
      settingsStore.markSyncedPetRecalled(petId);
      return studioState();
    },
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
              settingsStore.isPetVisible = true;
              petColonyController.showAll();
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
          resetPositions: () => petColonyController.resetPositions(),
          addPet: () => {
            petColonyController.addPet();
            refreshTray();
          },
          renamePet: () => studioWindowController?.show(),
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
            settingsStore.removeVideo(toPetActionSlot(String(record.slot ?? "")), Number(record.petIndex));
            petColonyController.refreshPlayback();
            refreshTray();
          },
          quit: () => app.quit()
        }) as MenuItemConstructorOptions[]
      )
    );
  };
  refreshTray();

  if (settingsStore.isPetVisible) {
    settingsStore.isPetVisible = petColonyController.showAll();
    refreshTray();
  }

  studioWindowController.show();
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {});

function requireAccount<T extends { accessToken: string } | undefined>(account: T) {
  if (!account) {
    throw new Error("请先登录账号。");
  }

  return account;
}

async function importDesktopBundle(
  bundle: Awaited<ReturnType<DesktopPetSyncClient["fetchBundle"]>>,
  input: {
    settingsStore: SettingsStore;
    petColonyController: PetColonyController;
    remoteMaterialRoot: string;
  }
) {
  const petsWithMaterials = bundle.pets.filter((pet) => pet.materials.length > 0);
  if (petsWithMaterials.length === 0) {
    throw DesktopPetSyncError.emptyBundle();
  }

  const desktopPets = displayablePets(bundle);
  if (desktopPets.length === 0) {
    input.settingsStore.saveSyncedPetCards(syncedPetCardsFromBundle(bundle));
    throw DesktopPetSyncError.missingIdleLoop();
  }

  if (input.settingsStore.petCount < desktopPets.length) {
    input.petColonyController.setPetCount(desktopPets.length);
  }

  let materialCount = 0;
  for (const [petIndex, pet] of desktopPets.entries()) {
    input.settingsStore.setPetName(pet.name, petIndex);

    for (const material of readyDesktopMaterials(pet)) {
      const videoPath = await downloadRemoteMaterial(material, pet.id, input.remoteMaterialRoot);
      input.settingsStore.saveVideoPath(videoPath, material.slot, petIndex);
      materialCount += 1;
    }
  }

  if (materialCount === 0) {
    throw DesktopPetSyncError.emptyBundle();
  }

  input.settingsStore.saveSyncedPetCards(syncedPetCardsFromBundle(bundle));
  input.settingsStore.isPetVisible = true;
  input.petColonyController.refreshDisplayNames();
  input.petColonyController.showAll();

  return {
    petCount: desktopPets.length,
    materialCount
  };
}

async function downloadRemoteMaterial(
  material: DesktopPetBundleMaterial,
  petID: string,
  remoteMaterialRoot: string
) {
  const response = await fetch(material.videoUrl);
  if (!response.ok) {
    throw DesktopPetSyncError.invalidResponse();
  }

  const fileExtension = materialFileExtension(material.videoUrl);
  const directory = path.join(remoteMaterialRoot, safeRemoteMaterialPathComponent(petID));
  const destination = path.join(directory, `${material.slot}${fileExtension}`);
  await mkdir(directory, { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

async function importLocalVideo(input: {
  petIndex: number;
  slot: PetActionSlot;
  settingsStore: SettingsStore;
  petColonyController: PetColonyController;
}) {
  const result = await dialog.showOpenDialog({
    title: "选择状态视频",
    buttonLabel: "选择视频",
    properties: ["openFile"],
    filters: [
      {
        name: "Video",
        extensions: ["mp4", "mov"]
      }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const videoPath = result.filePaths[0];
  const fileStats = await stat(videoPath);
  const videoMetadata = await probeLocalVideoMetadata(videoPath);
  const review = reviewPetVideoImport({
    fileSizeBytes: fileStats.size,
    durationSeconds: videoMetadata.durationSeconds,
    hasVideoTrack: videoMetadata.hasVideoTrack && isSupportedVideoFile(videoPath)
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

function materialFileExtension(videoUrl: string) {
  try {
    const extension = path.extname(new URL(videoUrl).pathname);
    return extension || ".mp4";
  } catch {
    return path.extname(videoUrl) || ".mp4";
  }
}

function isSupportedVideoFile(filePath: string) {
  return /\.(mp4|mov)$/i.test(filePath);
}
