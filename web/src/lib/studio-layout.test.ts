import test from "node:test";
import assert from "node:assert/strict";
import {
  accountNameEditControlCopy,
  jobGeneratedVideoApplyAction,
  materialCardPreviewState,
  petNameEditControlCopy,
  petPanelImageUrl,
  petPanelStats
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
  status: "首尾帧形象已就绪",
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

test("pet name edit control uses a compact pencil glyph with an accessible label", () => {
  assert.deepEqual(petNameEditControlCopy("栗子"), {
    ariaLabel: "编辑猫咪名字：栗子",
    icon: "✎"
  });
});

test("account name edit control uses a compact pencil glyph with an accessible label", () => {
  assert.deepEqual(accountNameEditControlCopy("栗子主人"), {
    ariaLabel: "编辑账号名称：栗子主人",
    icon: "✎"
  });
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
