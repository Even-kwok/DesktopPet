export const ipcChannels = {
  getStudioState: "studio:get-state",
  signIn: "studio:sign-in",
  signOut: "studio:sign-out",
  sync: "studio:sync",
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
  petDragBy: "pet:drag-by",
  petClick: "pet:click",
  petPlaybackEnded: "pet:playback-ended"
} as const;

type IpcHandler = (_event: unknown, ...args: unknown[]) => unknown;

export type IpcMainLike = {
  handle: (channel: string, handler: IpcHandler) => void;
  on: (channel: string, handler: IpcHandler) => void;
};

export type IpcDependencies = {
  getStudioState: () => unknown;
  signIn: (email: string, password: string) => unknown;
  signOut: () => unknown;
  sync: () => unknown;
  addPet: () => unknown;
  renamePet: (petIndex: number, name: string) => unknown;
  importVideo: (petIndex: number, slot: string) => unknown;
  removeVideo: (petIndex: number, slot: string) => unknown;
  setPetSize: (petIndex: number, scale: number) => unknown;
  showPets: () => unknown;
  hidePets: () => unknown;
  toggleClickThrough: () => unknown;
  toggleMouseoverCatch: () => unknown;
  resetPositions: () => unknown;
  refreshFriends: () => unknown;
  addFriend: (email: string) => unknown;
  removeFriend: (friendId: string) => unknown;
  requestHosting: (petId: string, toUserId: string) => unknown;
  recallPet: (petId: string) => unknown;
  petDragBy: (petIndex: number, delta: { x: number; y: number }) => unknown;
  petClick: (petIndex: number) => unknown;
  petPlaybackEnded: (petIndex: number) => unknown;
};

export function registerIpcHandlers(ipcMain: IpcMainLike, dependencies: IpcDependencies) {
  ipcMain.handle(ipcChannels.getStudioState, () => dependencies.getStudioState());
  ipcMain.handle(ipcChannels.signIn, (_event, email, password) =>
    dependencies.signIn(String(email ?? ""), String(password ?? ""))
  );
  ipcMain.handle(ipcChannels.signOut, () => dependencies.signOut());
  ipcMain.handle(ipcChannels.sync, () => dependencies.sync());
  ipcMain.handle(ipcChannels.addPet, () => dependencies.addPet());
  ipcMain.handle(ipcChannels.renamePet, (_event, petIndex, name) =>
    dependencies.renamePet(Number(petIndex), String(name ?? ""))
  );
  ipcMain.handle(ipcChannels.importVideo, (_event, petIndex, slot) =>
    dependencies.importVideo(Number(petIndex), String(slot))
  );
  ipcMain.handle(ipcChannels.removeVideo, (_event, petIndex, slot) =>
    dependencies.removeVideo(Number(petIndex), String(slot))
  );
  ipcMain.handle(ipcChannels.setPetSize, (_event, petIndex, scale) =>
    dependencies.setPetSize(Number(petIndex), Number(scale))
  );
  ipcMain.handle(ipcChannels.showPets, () => dependencies.showPets());
  ipcMain.handle(ipcChannels.hidePets, () => dependencies.hidePets());
  ipcMain.handle(ipcChannels.toggleClickThrough, () => dependencies.toggleClickThrough());
  ipcMain.handle(ipcChannels.toggleMouseoverCatch, () => dependencies.toggleMouseoverCatch());
  ipcMain.handle(ipcChannels.resetPositions, () => dependencies.resetPositions());
  ipcMain.handle(ipcChannels.refreshFriends, () => dependencies.refreshFriends());
  ipcMain.handle(ipcChannels.addFriend, (_event, email) => dependencies.addFriend(String(email ?? "")));
  ipcMain.handle(ipcChannels.removeFriend, (_event, friendId) => dependencies.removeFriend(String(friendId ?? "")));
  ipcMain.handle(ipcChannels.requestHosting, (_event, petId, toUserId) =>
    dependencies.requestHosting(String(petId ?? ""), String(toUserId ?? ""))
  );
  ipcMain.handle(ipcChannels.recallPet, (_event, petId) => dependencies.recallPet(String(petId ?? "")));
  ipcMain.on(ipcChannels.petDragBy, (_event, petIndex, delta) =>
    dependencies.petDragBy(Number(petIndex), normalizeDelta(delta))
  );
  ipcMain.on(ipcChannels.petClick, (_event, petIndex) => dependencies.petClick(Number(petIndex)));
  ipcMain.on(ipcChannels.petPlaybackEnded, (_event, petIndex) =>
    dependencies.petPlaybackEnded(Number(petIndex))
  );
}

function normalizeDelta(delta: unknown) {
  if (!delta || typeof delta !== "object") {
    return { x: 0, y: 0 };
  }

  const record = delta as Record<string, unknown>;
  return {
    x: Number(record.x ?? 0),
    y: Number(record.y ?? 0)
  };
}
