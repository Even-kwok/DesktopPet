import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accountNameEditControlCopy,
  buildClientPlatformCards,
  buildMaterialWorkflowSteps,
  desktopPublishFailureMessage,
  desktopPublishSuccessMessage,
  jobGeneratedVideoApplyAction,
  materialCardPreviewState,
  petNameEditControlCopy,
  petPanelImageUrl,
  petPanelStats,
  recallSuccessMessage,
  resolveWindowsClientDownloadUrl,
  studioStatusMessageClassName
} from "./studio-layout.ts";
import { materialSlots } from "./material-slots.ts";
import type { Pet } from "./types.ts";

const pet: Pet = {
  id: "pet_orange",
  petNumber: "CAT-20260616-0001",
  ownerUserId: "user_demo",
  currentHostUserId: "user_demo",
  name: "栗子",
  type: "cat",
  status: "绿幕形象已就绪",
  materialsReady: 8,
  mood: "同步",
  host: "me",
  ownership: "owned",
  locationStatus: "at_owner_desktop",
  sourceImageUrl: "https://example.com/source.png",
  frontImageUrl: "https://example.com/front.png"
};

test("pet panel uses local preview before saved image URLs", () => {
  assert.equal(
    petPanelImageUrl(pet, "blob:http://localhost/preview"),
    "blob:http://localhost/preview"
  );
  assert.equal(petPanelImageUrl(pet, null), "https://example.com/front.png");
});

test("pet panel does not render summary stat cards", () => {
  assert.deepEqual(petPanelStats({ readyCount: 0 }), []);
});

test("studio status message uses a visible tone class", () => {
  assert.equal(studioStatusMessageClassName("info"), "studio-status-message info");
  assert.equal(studioStatusMessageClassName("success"), "studio-status-message success");
  assert.equal(studioStatusMessageClassName("error"), "studio-status-message error");
});

test("pet name edit control uses a compact pencil glyph with an accessible label", () => {
  assert.deepEqual(petNameEditControlCopy("栗子"), {
    ariaLabel: "编辑猫咪名字：栗子",
    className: "icon-edit-button",
    icon: "✎"
  });
});

test("account name edit control uses a compact pencil glyph with an accessible label", () => {
  assert.deepEqual(accountNameEditControlCopy("栗子主人"), {
    ariaLabel: "编辑账号名称：栗子主人",
    className: "icon-edit-button",
    icon: "✎"
  });
});

test("client platform cards expose desktop download states and future mobile states", () => {
  assert.deepEqual(buildClientPlatformCards(null, null), [
    {
      id: "mac",
      title: "Mac 端",
      description: "桌面宠物主客户端，同步账号内已生成动作。",
      statusLabel: "优先入口",
      actionLabel: "安装包准备中",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "windows",
      title: "Windows 端",
      description: "Windows 桌面宠物客户端，同步账号内已生成动作。",
      statusLabel: "安装包准备中",
      actionLabel: "安装包准备中",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "ios",
      title: "iOS / iPadOS",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "android",
      title: "Android",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    }
  ]);

  const [mac, windows] = buildClientPlatformCards(
    "https://example.com/CatDesktopPet.dmg",
    "https://example.com/CatDesktopPetSetup.exe"
  );

  assert.deepEqual(mac, {
    id: "mac",
    title: "Mac 端",
    description: "桌面宠物主客户端，同步账号内已生成动作。",
    statusLabel: "可下载",
    actionLabel: "下载 Mac 版",
    actionUrl: "https://example.com/CatDesktopPet.dmg",
    isEnabled: true
  });
  assert.deepEqual(windows, {
    id: "windows",
    title: "Windows 端",
    description: "Windows 桌面宠物客户端，同步账号内已生成动作。",
    statusLabel: "可下载",
    actionLabel: "下载 Windows 版",
    actionUrl: "https://example.com/CatDesktopPetSetup.exe",
    isEnabled: true
  });
});

test("Windows client download URL defaults to the published test release", () => {
  assert.equal(
    resolveWindowsClientDownloadUrl(null),
    "https://github.com/Even-kwok/DesktopPet/releases/download/windows-test/CatDesktopPet-win-x64.zip"
  );
  assert.equal(
    resolveWindowsClientDownloadUrl(" https://example.com/custom-windows.zip "),
    "https://example.com/custom-windows.zip"
  );
});

test("material workflow steps describe the current generation path", () => {
  assert.deepEqual(
    buildMaterialWorkflowSteps({
      hasFrameImage: false,
      basicReadyCount: 0,
      basicTotalCount: 4,
      totalReadyCount: 0,
      hasMacDownload: false
    }),
    [
      { title: "上传绿幕图", state: "待上传" },
      { title: "补齐基础版", state: "0/4" },
      { title: "准备客户端", state: "安装包准备中" },
      { title: "同步到桌面", state: "待动作" }
    ]
  );

  assert.deepEqual(
    buildMaterialWorkflowSteps({
      hasFrameImage: true,
      basicReadyCount: 4,
      basicTotalCount: 4,
      totalReadyCount: 6,
      hasMacDownload: false,
      hasWindowsDownload: true
    }),
    [
      { title: "上传绿幕图", state: "已就位" },
      { title: "补齐基础版", state: "4/4" },
      { title: "准备客户端", state: "Windows 可下载" },
      { title: "同步到桌面", state: "可同步" }
    ]
  );
});

test("desktop publish status copy covers Mac and Windows clients", () => {
  assert.equal(desktopPublishSuccessMessage("supabase"), "桌面端的小窝已备好。");
  assert.equal(desktopPublishSuccessMessage("mock"), "预览小窝已更新。");
  assert.equal(
    desktopPublishFailureMessage(new Error("storage unavailable")),
    "同步到桌面端失败：storage unavailable"
  );
  assert.equal(desktopPublishFailureMessage("failed"), "同步到桌面端失败。");
});

test("recall success copy points to the shared desktop clients", () => {
  assert.equal(recallSuccessMessage(), "召回请求已发送。桌面 App 同步后会重新显示这只宠物。");
});

test("job display name uses the material name instead of slot code or provider id", async () => {
  const layout = await import("./studio-layout.ts");

  assert.equal(typeof layout.jobDisplayName, "function");
  assert.equal(
    layout.jobDisplayName(
      {
        jobId: "jimeng_Y2d0LTIwMjYwNjE3MTY1NDIxLXBsN2xu",
        type: "action_video",
        status: "succeeded",
        cost: 18,
        petId: "pet_orange",
        slot: "idle_loop"
      },
      materialSlots
    ),
    "待机循环"
  );
  assert.equal(
    layout.jobDisplayName(
      {
        jobId: "jimeng_front_image",
        type: "front_image",
        status: "succeeded",
        cost: 10,
        petId: "pet_orange"
      },
      materialSlots
    ),
    "形象图任务"
  );
});

test("job generated time label uses a readable Chinese timestamp", async () => {
  const layout = await import("./studio-layout.ts");

  assert.equal(typeof layout.jobGeneratedAtLabel, "function");
  assert.equal(
    layout.jobGeneratedAtLabel({
      jobId: "jimeng_Y2d0LTIwMjYwNjE3MTY1NDIxLXBsN2xu",
      type: "action_video",
      status: "succeeded",
      cost: 18,
      petId: "pet_orange",
      slot: "idle_loop",
      createdAt: "2026-06-17T08:54:21.000Z"
    }),
    "生成时间：2026-06-17 16:54"
  );
  assert.equal(
    layout.jobGeneratedAtLabel({
      jobId: "jimeng_no_time",
      type: "action_video",
      status: "queued",
      cost: 18,
      petId: "pet_orange",
      slot: "idle_loop"
    }),
    null
  );
});

test("completed action video jobs can be applied back to their original pet action pack", () => {
  assert.deepEqual(
    jobGeneratedVideoApplyAction(
      {
        jobId: "job_ready",
        type: "action_video",
        status: "succeeded",
        cost: 18,
        petId: pet.id,
        slot: "idle_loop",
        resultUrl: "https://example.com/old-idle.mp4"
      },
      [pet]
    ),
    {
      kind: "available",
      label: "应用到动作包"
    }
  );
  assert.deepEqual(
    jobGeneratedVideoApplyAction(
      {
        jobId: "job_deleted_pet",
        type: "action_video",
        status: "succeeded",
        cost: 18,
        petId: "pet_deleted",
        slot: "idle_loop",
        resultUrl: "https://example.com/deleted.mp4"
      },
      [pet]
    ),
    {
      kind: "unavailable",
      label: "宠物已删除",
      reason: "原猫咪已删除，无法应用到动作包。"
    }
  );
  assert.deepEqual(
    jobGeneratedVideoApplyAction(
      {
        jobId: "job_running",
        type: "action_video",
        status: "running",
        cost: 18,
        petId: pet.id,
        slot: "idle_loop"
      },
      [pet]
    ),
    { kind: "hidden" }
  );
});

test("failed regeneration keeps an existing generated material ready", async () => {
  const layout = await import("./studio-layout.ts");

  assert.equal(typeof layout.assetStatusAfterGenerationFailure, "function");
  assert.equal(
    layout.assetStatusAfterGenerationFailure({
      petId: "pet_orange",
      slot: "idle_loop",
      status: "generating",
      videoUrl: "https://example.com/old-idle.mp4"
    }),
    "ready"
  );
  assert.equal(layout.assetStatusAfterGenerationFailure(undefined), "failed");
});

test("material cards keep missing previews empty instead of showing slot emoji", async () => {
  assert.deepEqual(materialCardPreviewState({ hasActiveJob: false, isSubmitting: false }), {
    kind: "empty"
  });
  assert.deepEqual(
    materialCardPreviewState({
      asset: { status: "failed" },
      hasActiveJob: false,
      isSubmitting: false
    }),
    { kind: "empty" }
  );
  assert.deepEqual(
    materialCardPreviewState({
      asset: { status: "generating" },
      hasActiveJob: false,
      isSubmitting: false
    }),
    { kind: "icon", icon: "⏳" }
  );
  assert.deepEqual(
    materialCardPreviewState({
      asset: { status: "ready", videoUrl: "https://example.com/sleep.mp4" },
      hasActiveJob: true,
      isSubmitting: false
    }),
    { kind: "video", videoUrl: "https://example.com/sleep.mp4" }
  );
});

test("material cards do not render a separate preview button", () => {
  const studioSource = readFileSync("src/components/studio/studio-app.tsx", "utf8");

  assert.doesNotMatch(studioSource, /<a[\s\S]*?>\s*预览\s*<\/a>/);
});
