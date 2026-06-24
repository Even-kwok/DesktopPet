import assert from "node:assert/strict";
import test from "node:test";
import { ipcChannels, registerIpcHandlers } from "../src/main/ipc.ts";
import type { IpcDependencies, IpcMainLike } from "../src/main/ipc.ts";

test("lists the stable preload IPC channels", () => {
  assert.deepEqual(ipcChannels, {
    getStudioState: "studio:get-state",
    signIn: "studio:sign-in",
    signOut: "studio:sign-out",
    sync: "studio:sync",
    selectSyncedPet: "studio:select-synced-pet",
    studioCommand: "studio:command",
    addPet: "pets:add",
    removePet: "pets:remove",
    renamePet: "pets:rename",
    importVideo: "pets:import-video",
    removeVideo: "pets:remove-video",
    setPetSize: "pets:set-size",
    showPets: "pets:show",
    hidePets: "pets:hide",
    toggleClickThrough: "pets:toggle-click-through",
    toggleMouseoverCatch: "pets:toggle-mouseover-catch",
    resetPositions: "pets:reset-positions",
    refreshFriends: "friends:refresh",
    addFriend: "friends:add",
    removeFriend: "friends:remove",
    requestHosting: "hosting:request",
    updateHostingRequest: "hosting:update",
    recallPet: "hosting:recall",
    petDragStarted: "pet:drag-started",
    petDragBy: "pet:drag-by",
    petDragEnded: "pet:drag-ended",
    petClick: "pet:click",
    petPlaybackEnded: "pet:playback-ended"
  });
});

test("normalizes invalid pet drag deltas from renderer IPC", () => {
  const ipcMain = new FakeIpcMain();
  const dragEvents: Array<{ petIndex: number; delta: { x: number; y: number } }> = [];

  registerIpcHandlers(ipcMain, {
    ...stubDependencies(),
    petDragBy: (petIndex, delta) => {
      dragEvents.push({ petIndex, delta });
    }
  });

  ipcMain.emitOn(ipcChannels.petDragBy, {}, 1, { x: "bad", y: Number.POSITIVE_INFINITY });
  ipcMain.emitOn(ipcChannels.petDragBy, {}, 1, { x: "4.5", y: -2 });
  ipcMain.emitOn(ipcChannels.petDragBy, {}, 1, undefined);

  assert.deepEqual(dragEvents, [
    { petIndex: 1, delta: { x: 0, y: 0 } },
    { petIndex: 1, delta: { x: 4.5, y: -2 } },
    { petIndex: 1, delta: { x: 0, y: 0 } }
  ]);
});

class FakeIpcMain implements IpcMainLike {
  readonly #onHandlers = new Map<string, (...args: unknown[]) => unknown>();

  handle() {}

  on(channel: string, handler: (...args: unknown[]) => unknown) {
    this.#onHandlers.set(channel, handler);
  }

  emitOn(channel: string, ...args: unknown[]) {
    this.#onHandlers.get(channel)?.(...args);
  }
}

function stubDependencies(): IpcDependencies {
  return {
    getStudioState: () => undefined,
    signIn: () => undefined,
    signOut: () => undefined,
    sync: () => undefined,
    selectSyncedPet: () => undefined,
    addPet: () => undefined,
    removePet: () => undefined,
    renamePet: () => undefined,
    importVideo: () => undefined,
    removeVideo: () => undefined,
    setPetSize: () => undefined,
    showPets: () => undefined,
    hidePets: () => undefined,
    toggleClickThrough: () => undefined,
    toggleMouseoverCatch: () => undefined,
    resetPositions: () => undefined,
    refreshFriends: () => undefined,
    addFriend: () => undefined,
    removeFriend: () => undefined,
    requestHosting: () => undefined,
    updateHostingRequest: () => undefined,
    recallPet: () => undefined,
    petDragStarted: () => undefined,
    petDragBy: () => undefined,
    petDragEnded: () => undefined,
    petClick: () => undefined,
    petPlaybackEnded: () => undefined
  };
}
