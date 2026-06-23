import assert from "node:assert/strict";
import test from "node:test";
import { ipcChannels } from "../src/main/ipc.ts";

test("lists the stable preload IPC channels", () => {
  assert.deepEqual(ipcChannels, {
    getStudioState: "studio:get-state",
    signIn: "studio:sign-in",
    signOut: "studio:sign-out",
    sync: "studio:sync",
    selectSyncedPet: "studio:select-synced-pet",
    addPet: "pets:add",
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
    recallPet: "hosting:recall",
    petDragStarted: "pet:drag-started",
    petDragBy: "pet:drag-by",
    petDragEnded: "pet:drag-ended",
    petClick: "pet:click",
    petPlaybackEnded: "pet:playback-ended"
  });
});
