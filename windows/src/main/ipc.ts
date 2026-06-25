export const ipcChannels = {
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
  petDragStarted: "pet:drag-started",
  petDragBy: "pet:drag-by",
  petDragEnded: "pet:drag-ended",
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
  selectSyncedPet: (petId: string) => unknown;
  addPet: () => unknown;
  removePet: (petIndex: number) => unknown;
  renamePet: (petIndex: number, name: string) => unknown;
  importVideo: (petIndex: number, slot: string) => unknown;
  removeVideo: (petIndex: number, slot: string) => unknown;
  setPetSize: (petIndex: number, scale: number) => unknown;
  showPets: () => unknown;
  hidePets: () => unknown;
  toggleClickThrough: () => unknown;
  toggleMouseoverCatch: () => unknown;
  resetPositions: () => unknown;
  petDragStarted: (petIndex: number) => unknown;
  petDragBy: (petIndex: number, delta: { x: number; y: number }) => unknown;
  petDragEnded: (petIndex: number) => unknown;
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
  ipcMain.handle(ipcChannels.selectSyncedPet, (_event, petId) =>
    dependencies.selectSyncedPet(String(petId ?? ""))
  );
  ipcMain.handle(ipcChannels.addPet, () => dependencies.addPet());
  ipcMain.handle(ipcChannels.removePet, (_event, petIndex) => dependencies.removePet(Number(petIndex)));
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
  ipcMain.on(ipcChannels.petDragStarted, (_event, petIndex) =>
    dependencies.petDragStarted(Number(petIndex))
  );
  ipcMain.on(ipcChannels.petDragBy, (_event, petIndex, delta) =>
    dependencies.petDragBy(Number(petIndex), normalizeDelta(delta))
  );
  ipcMain.on(ipcChannels.petDragEnded, (_event, petIndex) => dependencies.petDragEnded(Number(petIndex)));
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
    x: finiteNumberOrZero(record.x),
    y: finiteNumberOrZero(record.y)
  };
}

function finiteNumberOrZero(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
