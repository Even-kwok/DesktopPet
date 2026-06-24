import assert from "node:assert/strict";
import test from "node:test";
import {
  canSendRendererCommand,
  hasLoadedRendererURL,
  nextRendererShowRevision,
  settleRendererShow,
  shouldFinishRendererShow
} from "../src/main/renderer-load-policy.ts";

test("treats Electron error pages as not loaded so later shows can retry", () => {
  assert.equal(hasLoadedRendererURL(""), false);
  assert.equal(hasLoadedRendererURL("about:blank"), false);
  assert.equal(hasLoadedRendererURL("chrome-error://chromewebdata/"), false);
  assert.equal(hasLoadedRendererURL("file:///app/out/renderer/index.html"), true);
  assert.equal(hasLoadedRendererURL("http://localhost:5173"), true);
});

test("allows only the latest visible renderer show request to finish", () => {
  const firstShow = nextRendererShowRevision(0);
  const hiddenBeforeLoadFinishes = nextRendererShowRevision(firstShow);
  const secondShow = nextRendererShowRevision(hiddenBeforeLoadFinishes);

  assert.equal(
    shouldFinishRendererShow({
      requestRevision: firstShow,
      currentRevision: hiddenBeforeLoadFinishes,
      isVisible: false
    }),
    false
  );
  assert.equal(
    shouldFinishRendererShow({
      requestRevision: firstShow,
      currentRevision: secondShow,
      isVisible: true
    }),
    false
  );
  assert.equal(
    shouldFinishRendererShow({
      requestRevision: secondShow,
      currentRevision: secondShow,
      isVisible: true
    }),
    true
  );
});

test("does not finish a renderer show when the target window is gone", () => {
  assert.equal(
    shouldFinishRendererShow({
      requestRevision: 1,
      currentRevision: 1,
      isVisible: true,
      canUseRendererTarget: false
    }),
    false
  );
});

test("sends renderer commands only to live web contents", () => {
  assert.equal(
    canSendRendererCommand({
      hasWindow: false,
      isWebContentsDestroyed: false
    }),
    false
  );
  assert.equal(
    canSendRendererCommand({
      hasWindow: true,
      isWebContentsDestroyed: true
    }),
    false
  );
  assert.equal(
    canSendRendererCommand({
      hasWindow: true,
      isWebContentsDestroyed: false
    }),
    true
  );
});

test("settles failed renderer loads without running show completion", async () => {
  let finishCount = 0;

  await assert.doesNotReject(
    settleRendererShow({
      load: Promise.reject(new Error("renderer unavailable")),
      finish: () => {
        finishCount += 1;
      }
    })
  );

  assert.equal(finishCount, 0);
});

test("runs show completion after a successful renderer load", async () => {
  let finishCount = 0;

  await settleRendererShow({
    load: Promise.resolve(),
    finish: () => {
      finishCount += 1;
    }
  });

  assert.equal(finishCount, 1);
});
