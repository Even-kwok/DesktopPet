import test from "node:test";
import assert from "node:assert/strict";
import {
  actionVideoStoragePath,
  isAcceptableActionVideoDownload,
  shouldMirrorActionVideoUrl
} from "./action-video-storage.ts";

test("action video storage mirrors expiring provider URLs", () => {
  assert.equal(
    shouldMirrorActionVideoUrl(
      "https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/result.mp4?X-Tos-Algorithm=TOS4-HMAC-SHA256",
      "action-videos"
    ),
    true
  );
});

test("action video storage keeps stable release and Supabase action URLs", () => {
  assert.equal(
    shouldMirrorActionVideoUrl(
      "https://github.com/Even-kwok/DesktopPet/releases/download/starter-assets/starter-cat-idle_loop.mp4",
      "action-videos"
    ),
    false
  );
  assert.equal(
    shouldMirrorActionVideoUrl(
      "https://ivfwglewtifzefsygdgl.supabase.co/storage/v1/object/public/action-videos/pet/idle/job.mp4",
      "action-videos"
    ),
    false
  );
});

test("action video storage path sanitizes user controlled segments", () => {
  assert.equal(
    actionVideoStoragePath({
      petId: "pet/demo:1",
      slot: "idle loop",
      jobId: "jimeng/a+b",
      extension: "mov"
    }),
    "pet-demo-1/idle-loop/jimeng-a-b.mov"
  );
});

test("action video storage rejects static image and document downloads", () => {
  assert.equal(
    isAcceptableActionVideoDownload({
      contentType: "image/png",
      pathname: "/result.png"
    }),
    false
  );
  assert.equal(
    isAcceptableActionVideoDownload({
      contentType: "text/html; charset=utf-8",
      pathname: "/error"
    }),
    false
  );
  assert.equal(
    isAcceptableActionVideoDownload({
      contentType: "application/json",
      pathname: "/result"
    }),
    false
  );
});

test("action video storage accepts video downloads and signed video URLs", () => {
  assert.equal(
    isAcceptableActionVideoDownload({
      contentType: "video/mp4",
      pathname: "/result"
    }),
    true
  );
  assert.equal(
    isAcceptableActionVideoDownload({
      contentType: "application/octet-stream",
      pathname: "/result.webm"
    }),
    true
  );
});
