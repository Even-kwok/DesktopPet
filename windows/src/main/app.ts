import { app, ipcMain, powerMonitor } from "electron";
import path from "node:path";
import { PetColonyController } from "./pet-colony-controller.ts";
import { PetWindowController } from "./pet-window-controller.ts";
import { StudioWindowController } from "./studio-window-controller.ts";
import { registerIpcHandlers } from "./ipc.ts";
import { SettingsStore } from "../shared/settings-store.ts";
import { SleepRecoveryCoordinator } from "../shared/sleep-recovery-coordinator.ts";
import type { PetActionSlot } from "../shared/pet-action-slots.ts";

let studioWindowController: StudioWindowController | undefined;

async function bootstrap() {
  const settingsStore = new SettingsStore(path.join(app.getPath("userData"), "settings.json"));
  const petColonyController = new PetColonyController(
    settingsStore,
    (petIndex) => new PetWindowController(settingsStore, petIndex)
  );
  studioWindowController = new StudioWindowController();
  const sleepRecoveryCoordinator = new SleepRecoveryCoordinator(
    () => petColonyController.prepareForSystemSleep(),
    () => petColonyController.resumeAfterSystemWake()
  );

  registerIpcHandlers(ipcMain, {
    getStudioState: () => ({
      account: settingsStore.currentAccount,
      petCount: settingsStore.petCount,
      isPetVisible: settingsStore.isPetVisible,
      isClickThrough: settingsStore.isClickThrough,
      isMouseoverCatchEnabled: settingsStore.isMouseoverCatchEnabled
    }),
    signIn: () => undefined,
    signOut: () => {
      settingsStore.signOut();
    },
    sync: () => undefined,
    addPet: () => petColonyController.addPet(),
    renamePet: (petIndex, name) => {
      settingsStore.setPetName(name, petIndex);
      petColonyController.refreshDisplayNames();
    },
    importVideo: () => undefined,
    removeVideo: (petIndex, slot) => {
      settingsStore.removeVideo(slot as PetActionSlot, petIndex);
      petColonyController.refreshPlayback();
    },
    setPetSize: (petIndex, scale) => petColonyController.setPetSizeScale(scale, petIndex),
    showPets: () => {
      settingsStore.isPetVisible = true;
      return petColonyController.showAll();
    },
    hidePets: () => {
      settingsStore.isPetVisible = false;
      petColonyController.hideAll();
    },
    toggleClickThrough: () => {
      settingsStore.isClickThrough = !settingsStore.isClickThrough;
      petColonyController.setClickThrough(settingsStore.isClickThrough);
      return settingsStore.isClickThrough;
    },
    toggleMouseoverCatch: () => {
      settingsStore.isMouseoverCatchEnabled = !settingsStore.isMouseoverCatchEnabled;
      petColonyController.refreshPlayback();
      return settingsStore.isMouseoverCatchEnabled;
    },
    resetPositions: () => petColonyController.resetPositions(),
    refreshFriends: () => [],
    addFriend: () => undefined,
    removeFriend: () => undefined,
    requestHosting: () => undefined,
    recallPet: () => undefined,
    petDragBy: () => undefined,
    petClick: () => undefined,
    petPlaybackEnded: () => undefined
  });

  powerMonitor.on("suspend", () => sleepRecoveryCoordinator.systemWillSleep());
  powerMonitor.on("resume", () => sleepRecoveryCoordinator.systemDidWake());

  studioWindowController.show();
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {});
