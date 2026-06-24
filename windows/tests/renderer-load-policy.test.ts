import assert from "node:assert/strict";
import test from "node:test";
import {
  nextRendererShowRevision,
  shouldFinishRendererShow
} from "../src/main/renderer-load-policy.ts";

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
