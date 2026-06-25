import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const studioAppSource = readFileSync(
  fileURLToPath(new URL("../src/renderer/studio/StudioApp.tsx", import.meta.url)),
  "utf8"
);

const studioWindowControllerSource = readFileSync(
  fileURLToPath(new URL("../src/main/studio-window-controller.ts", import.meta.url)),
  "utf8"
);

const mainAppSource = readFileSync(
  fileURLToPath(new URL("../src/main/app.ts", import.meta.url)),
  "utf8"
);

test("starts Windows Studio login fields empty instead of prefilled with demo credentials", () => {
  assert.doesNotMatch(studioAppSource, /useState\("demo@desktop\.pet"\)/);
  assert.doesNotMatch(studioAppSource, /useState\("123456"\)/);
  assert.doesNotMatch(studioAppSource, /demo@desktop\.pet/);
});

test("keeps local material management out of the Windows Studio surface", () => {
  assert.doesNotMatch(studioAppSource, /动作卡册/);
  assert.doesNotMatch(studioAppSource, /localMaterialBoard/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.importVideo/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.removeVideo/);
});

test("keeps desktop pet controls out of the Windows Studio surface", () => {
  assert.doesNotMatch(studioAppSource, /桌面宠物/);
  assert.doesNotMatch(studioAppSource, /宠物大小/);
  assert.doesNotMatch(studioAppSource, /添加宠物/);
  assert.doesNotMatch(studioAppSource, /删除宠物/);
  assert.doesNotMatch(studioAppSource, /保存名称/);
  assert.doesNotMatch(studioAppSource, /开启穿透|关闭穿透/);
  assert.doesNotMatch(studioAppSource, /开启抓虫|关闭抓虫/);
  assert.doesNotMatch(studioAppSource, /重置位置/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.addPet/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.removePet/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.renamePet/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.setPetSize/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.showPets/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.hidePets/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.toggleClickThrough/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.toggleMouseoverCatch/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.resetPositions/);
});

test("orders Windows Studio cards as account, then synced cats", () => {
  const accountIndex = studioAppSource.indexOf('className="studio-topbar"');
  const syncedPetIndex = studioAppSource.indexOf("{syncedPetPanelTitle()}");

  assert.notEqual(accountIndex, -1);
  assert.notEqual(syncedPetIndex, -1);
  assert.ok(accountIndex < syncedPetIndex);
});

test("shows login feedback near the top of the Windows Studio window", () => {
  const statusIndex = studioAppSource.indexOf('className="status-line" role="status"');
  const gridIndex = studioAppSource.indexOf('className="studio-grid"');

  assert.notEqual(statusIndex, -1);
  assert.notEqual(gridIndex, -1);
  assert.ok(statusIndex < gridIndex);
  assert.doesNotMatch(studioAppSource, /bridge\?\.signIn\?\./);
});

test("keeps paused friend and hosting controls out of the Windows Studio surface", () => {
  assert.doesNotMatch(studioAppSource, /好友/);
  assert.doesNotMatch(studioAppSource, /friendPanel/);
  assert.doesNotMatch(studioAppSource, /friendEmail/);
  assert.doesNotMatch(studioAppSource, /refreshFriends/);
  assert.doesNotMatch(studioAppSource, /addFriend/);
  assert.doesNotMatch(studioAppSource, /removeFriend/);
  assert.doesNotMatch(studioAppSource, /寄养/);
  assert.doesNotMatch(studioAppSource, /召回/);
  assert.doesNotMatch(studioAppSource, /送回/);
  assert.doesNotMatch(studioAppSource, /hostingPetPickerFriend/);
  assert.doesNotMatch(studioAppSource, /className="hosting-pet-picker"/);
  assert.doesNotMatch(studioAppSource, /requestFriendHosting/);
  assert.doesNotMatch(studioAppSource, /respondToHostingRequest/);
  assert.doesNotMatch(studioAppSource, /recallSyncedPet/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.requestHosting/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.updateHostingRequest/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.recallPet/);
});

test("renders synced cat avatars in the Windows Studio list", () => {
  assert.match(studioAppSource, /pet\.avatarUrl/);
  assert.match(studioAppSource, /className="synced-pet-avatar"/);
});

test("does not expose manual Windows hosting refresh in the first realtime hosting flow", () => {
  assert.doesNotMatch(studioAppSource, /刷新寄养/);
  assert.doesNotMatch(studioAppSource, /手动查看/);
  assert.doesNotMatch(studioAppSource, /bridge\?\.refreshHostingRequests\?\.\(\)/);
});

test("keeps paused friend and hosting IPC out of the Windows main/preload bridge", () => {
  const ipcSource = readFileSync(
    fileURLToPath(new URL("../src/main/ipc.ts", import.meta.url)),
    "utf8"
  );
  const preloadSource = readFileSync(
    fileURLToPath(new URL("../src/preload/index.ts", import.meta.url)),
    "utf8"
  );

  for (const source of [mainAppSource, ipcSource, preloadSource]) {
    assert.doesNotMatch(source, /refreshFriends/);
    assert.doesNotMatch(source, /addFriend/);
    assert.doesNotMatch(source, /removeFriend/);
    assert.doesNotMatch(source, /friends:/);
    assert.doesNotMatch(source, /requestHosting/);
    assert.doesNotMatch(source, /updateHostingRequest/);
    assert.doesNotMatch(source, /recallPet/);
    assert.doesNotMatch(source, /hosting:request/);
    assert.doesNotMatch(source, /hosting:update/);
    assert.doesNotMatch(source, /hosting:recall/);
  }
});

test("removes the native menu from the Windows Studio window", () => {
  assert.match(studioWindowControllerSource, /window\.setMenu\(null\)/);
});

test("uses Electron networking for Windows desktop sync requests", () => {
  assert.match(mainAppSource, /import \{[^}]*net[^}]*\} from "electron"/);
  assert.match(mainAppSource, /net\.fetch\(input instanceof URL \? input\.toString\(\) : input, init\)/);
});
