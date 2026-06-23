import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "../main/ipc.ts";

const desktopPet = {
  getStudioState: () => ipcRenderer.invoke(ipcChannels.getStudioState),
  signIn: (email: string, password: string) => ipcRenderer.invoke(ipcChannels.signIn, email, password),
  signOut: () => ipcRenderer.invoke(ipcChannels.signOut),
  sync: () => ipcRenderer.invoke(ipcChannels.sync),
  addPet: () => ipcRenderer.invoke(ipcChannels.addPet),
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
  recallPet: (petId: string) => ipcRenderer.invoke(ipcChannels.recallPet, petId),
  petDragBy: (petIndex: number, delta: { x: number; y: number }) =>
    ipcRenderer.send(ipcChannels.petDragBy, petIndex, delta),
  petClick: (petIndex: number) => ipcRenderer.send(ipcChannels.petClick, petIndex),
  petPlaybackEnded: (petIndex: number) => ipcRenderer.send(ipcChannels.petPlaybackEnded, petIndex)
};

contextBridge.exposeInMainWorld("desktopPet", desktopPet);

export type DesktopPetBridge = typeof desktopPet;
