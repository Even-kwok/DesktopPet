import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrayMenuTemplate,
  resetPositionsActionPlan,
  visibilityResultAfterShowingPets
} from "../src/main/tray-controller.ts";

test("builds Mac-parity tray menu labels", () => {
  const template = buildTrayMenuTemplate({
    petCount: 1,
    isVisible: false,
    isClickThrough: false,
    isMouseoverCatchEnabled: true,
    petName: () => "栗子",
    hasVideo: (slot) => slot === "idle_loop",
    petSizeScale: () => 1
  });

  assert.deepEqual(
    template.filter((item) => item.type !== "separator").map((item) => item.label),
    ["打开素材工作台", "选择状态视频", "删除状态视频", "宠物", "显示宠物", "切换点击穿透", "切换鼠标经过抓虫", "重置位置", "退出"]
  );
});

test("builds Mac-parity tray menu accelerators", () => {
  const template = buildTrayMenuTemplate({
    petCount: 1,
    isVisible: false,
    isClickThrough: false,
    isMouseoverCatchEnabled: true,
    petName: () => "栗子",
    hasVideo: (slot) => slot === "idle_loop",
    petSizeScale: () => 1
  });

  assert.deepEqual(
    template.filter((item) => item.type !== "separator").map((item) => [item.label, item.accelerator]),
    [
      ["打开素材工作台", "CommandOrControl+,"],
      ["选择状态视频", undefined],
      ["删除状态视频", undefined],
      ["宠物", undefined],
      ["显示宠物", "CommandOrControl+S"],
      ["切换点击穿透", "CommandOrControl+T"],
      ["切换鼠标经过抓虫", "CommandOrControl+W"],
      ["重置位置", "CommandOrControl+R"],
      ["退出", "CommandOrControl+Q"]
    ]
  );

  assert.equal(template[2].submenu?.[0].submenu?.[0].accelerator, "CommandOrControl+O");
  assert.equal(template[4].submenu?.[2].accelerator, "CommandOrControl+N");
});

test("adds pet thumbnails to pet submenus like the Mac status menu", () => {
  const template = buildTrayMenuTemplate({
    petCount: 2,
    isVisible: false,
    isClickThrough: false,
    isMouseoverCatchEnabled: true,
    petName: (petIndex) => (petIndex === 0 ? "栗子" : "团子"),
    petIcon: (petIndex) => `icon-${petIndex}`,
    hasVideo: (slot) => slot === "idle_loop",
    petSizeScale: () => 1
  });

  assert.equal(template[2].submenu?.[0].icon, "icon-0");
  assert.equal(template[2].submenu?.[1].icon, "icon-1");
  assert.equal(template[3].submenu?.[0].icon, "icon-0");
  assert.equal(template[4].submenu?.[3].submenu?.[1].icon, "icon-1");
  assert.equal(template[4].submenu?.[4].submenu?.[0].icon, "icon-0");
  assert.equal(template[4].submenu?.[5].submenu?.[1].icon, "icon-1");
});

test("normalizes malformed pet counts before building Windows tray menus", () => {
  for (const petCount of [Number.NaN, Number.POSITIVE_INFINITY, -1.5]) {
    const template = buildTrayMenuTemplate({
      petCount,
      isVisible: false,
      isClickThrough: false,
      isMouseoverCatchEnabled: true,
      petName: () => "栗子",
      hasVideo: () => false,
      petSizeScale: () => 1
    });

    assert.equal(template[2].submenu?.length, 0);
    assert.equal(template[3].submenu?.length, 0);
    assert.equal(template[4].submenu?.[0].label, "当前宠物数：0");
    assert.equal(template[4].submenu?.[2].label, "添加宠物");
    assert.equal(template[4].submenu?.[3].enabled, false);
    assert.equal(template[4].submenu?.[4].enabled, false);
    assert.equal(template[4].submenu?.[5].enabled, false);
  }
});

test("requests an idle-loop import when tray show cannot display a pet", () => {
  assert.deepEqual(visibilityResultAfterShowingPets(false), {
    isPetVisible: false,
    importIdleLoop: true,
    petIndex: 0,
    slot: "idle_loop"
  });

  assert.deepEqual(visibilityResultAfterShowingPets(true), {
    isPetVisible: true,
    importIdleLoop: false
  });
});

test("refreshes tray state after resetting pet positions like the Mac status menu", () => {
  assert.deepEqual(resetPositionsActionPlan(), {
    refreshTray: true
  });
});
