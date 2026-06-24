import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "../main/ipc.ts";
import { createLatestEventBuffer } from "./event-buffer.ts";

const petCommandBuffer = createLatestEventBuffer<unknown>();
const studioCommandBuffer = createLatestEventBuffer<unknown>();

ipcRenderer.on(ipcChannels.studioCommand, (_event, command: unknown) => {
  studioCommandBuffer.emit(command);
});

ipcRenderer.on("pet:command", (_event, command: unknown) => {
  petCommandBuffer.emit(command);
});

const desktopPet = {
  getStudioState: () => ipcRenderer.invoke(ipcChannels.getStudioState),
  signIn: (email: string, password: string) => ipcRenderer.invoke(ipcChannels.signIn, email, password),
  signOut: () => ipcRenderer.invoke(ipcChannels.signOut),
  sync: () => ipcRenderer.invoke(ipcChannels.sync),
  selectSyncedPet: (petId: string) => ipcRenderer.invoke(ipcChannels.selectSyncedPet, petId),
  addPet: () => ipcRenderer.invoke(ipcChannels.addPet),
  removePet: (petIndex: number) => ipcRenderer.invoke(ipcChannels.removePet, petIndex),
  renamePet: (petIndex: number, name: string) => ipcRenderer.invoke(ipcChannels.renamePet, petIndex, name),
  importVideo: (petIndex: number, slot: string) => ipcRenderer.invoke(ipcChannels.importVideo, petIndex, slot),
  removeVideo: (petIndex: number, slot: string) => ipcRenderer.invoke(ipcChannels.removeVideo, petIndex, slot),
  setPetSize: (petIndex: number, scale: number) => ipcRenderer.invoke(ipcChannels.setPetSize, petIndex, scale),
  showPets: () => ipcRenderer.invoke(ipcChannels.showPets),
  hidePets: () => ipcRenderer.invoke(ipcChannels.hidePets),
  toggleClickThrough: () => ipcRenderer.invoke(ipcChannels.toggleClickThrough),
  toggleMouseoverCatch: () => ipcRenderer.invoke(ipcChannels.toggleMouseoverCatch),
  resetPositions: () => ipcRenderer.invoke(ipcChannels.resetPositions),
  refreshFriends: () => ipcRenderer.invoke(ipcChannels.refreshFriends),
  addFriend: (email: string) => ipcRenderer.invoke(ipcChannels.addFriend, email),
  removeFriend: (friendId: string) => ipcRenderer.invoke(ipcChannels.removeFriend, friendId),
  requestHosting: (petId: string, toUserId: string) =>
    ipcRenderer.invoke(ipcChannels.requestHosting, petId, toUserId),
  updateHostingRequest: (requestId: string, action: "accept" | "decline" | "return") =>
    ipcRenderer.invoke(ipcChannels.updateHostingRequest, requestId, action),
  recallPet: (petId: string) => ipcRenderer.invoke(ipcChannels.recallPet, petId),
  petDragStarted: (petIndex: number) => ipcRenderer.send(ipcChannels.petDragStarted, petIndex),
  petDragBy: (petIndex: number, delta: { x: number; y: number }) =>
    ipcRenderer.send(ipcChannels.petDragBy, petIndex, delta),
  petDragEnded: (petIndex: number) => ipcRenderer.send(ipcChannels.petDragEnded, petIndex),
  petClick: (petIndex: number) => ipcRenderer.send(ipcChannels.petClick, petIndex),
  petPlaybackEnded: (petIndex: number) => ipcRenderer.send(ipcChannels.petPlaybackEnded, petIndex),
  onPetCommand: (callback: (command: unknown) => void) => {
    return petCommandBuffer.subscribe(callback);
  },
  onStudioCommand: (callback: (command: unknown) => void) => {
    return studioCommandBuffer.subscribe(callback);
  }
};

contextBridge.exposeInMainWorld("desktopPet", desktopPet);

export type DesktopPetBridge = typeof desktopPet;
