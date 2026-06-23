import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrayMenuTemplate,
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
