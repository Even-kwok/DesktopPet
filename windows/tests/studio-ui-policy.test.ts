import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const studioAppSource = readFileSync(
  fileURLToPath(new URL("../src/renderer/studio/StudioApp.tsx", import.meta.url)),
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

test("orders Windows Studio cards as account, friends, then synced cats", () => {
  const accountIndex = studioAppSource.indexOf('className="studio-topbar"');
  const friendIndex = studioAppSource.indexOf("{friendPanelTitle()}");
  const syncedPetIndex = studioAppSource.indexOf("{syncedPetPanelTitle()}");

  assert.notEqual(accountIndex, -1);
  assert.notEqual(friendIndex, -1);
  assert.notEqual(syncedPetIndex, -1);
  assert.ok(accountIndex < friendIndex);
  assert.ok(friendIndex < syncedPetIndex);
});

test("shows login feedback near the top of the Windows Studio window", () => {
  const statusIndex = studioAppSource.indexOf('className="status-line" role="status"');
  const gridIndex = studioAppSource.indexOf('className="studio-grid"');

  assert.notEqual(statusIndex, -1);
  assert.notEqual(gridIndex, -1);
  assert.ok(statusIndex < gridIndex);
  assert.doesNotMatch(studioAppSource, /bridge\?\.signIn\?\./);
});
