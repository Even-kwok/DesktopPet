import assert from "node:assert/strict";
import test from "node:test";
import {
  studioCommandDispatchPlan,
  studioCommandForShow,
  studioCommandFromPetPayload,
  studioRendererLoadTarget
} from "../src/main/studio-window-policy.ts";

test("loads the Studio renderer only before the window has navigated", () => {
  const rendererFile = "/app/out/renderer/index.html";

  assert.deepEqual(
    studioRendererLoadTarget({
      currentURL: "",
      studioRendererURL: "http://localhost:5173",
      studioRendererFile: rendererFile
    }),
    { type: "url", value: "http://localhost:5173" }
  );

  assert.deepEqual(
    studioRendererLoadTarget({
      currentURL: "http://localhost:5173",
      studioRendererURL: "http://localhost:5173",
      studioRendererFile: rendererFile
    }),
    { type: "none" }
  );

  assert.deepEqual(
    studioRendererLoadTarget({
      currentURL: "",
      studioRendererFile: rendererFile
    }),
    { type: "file", value: rendererFile }
  );

  assert.deepEqual(
    studioRendererLoadTarget({
      currentURL: "about:blank",
      studioRendererURL: "http://localhost:5173",
      studioRendererFile: rendererFile
    }),
    { type: "url", value: "http://localhost:5173" }
  );

  assert.deepEqual(
    studioRendererLoadTarget({
      currentURL: "file:///app/out/renderer/index.html",
      studioRendererFile: rendererFile
    }),
    { type: "none" }
  );
});

test("builds a Studio pet selection command from a tray pet payload", () => {
  assert.deepEqual(studioCommandFromPetPayload({ petIndex: 1 }), {
    type: "selectPet",
    petIndex: 1
  });
  assert.equal(studioCommandFromPetPayload({ petIndex: Number.NaN }), undefined);
  assert.equal(studioCommandFromPetPayload({}), undefined);
});

test("refreshes Studio state when showing without a specific command", () => {
  const selectCommand = { type: "selectPet" as const, petIndex: 2 };

  assert.deepEqual(studioCommandForShow(undefined), { type: "refresh" });
  assert.equal(studioCommandForShow(selectCommand), selectCommand);
});

test("sends only the latest visible Studio show command after renderer loading", () => {
  const staleSelectCommand = { type: "selectPet" as const, petIndex: 2 };
  const latestSelectCommand = { type: "selectPet" as const, petIndex: 1 };

  assert.equal(
    studioCommandDispatchPlan({
      command: staleSelectCommand,
      requestRevision: 1,
      currentRevision: 2,
      isVisible: false
    }),
    undefined
  );
  assert.equal(
    studioCommandDispatchPlan({
      command: staleSelectCommand,
      requestRevision: 1,
      currentRevision: 3,
      isVisible: true
    }),
    undefined
  );
  assert.deepEqual(
    studioCommandDispatchPlan({
      command: latestSelectCommand,
      requestRevision: 3,
      currentRevision: 3,
      isVisible: true
    }),
    latestSelectCommand
  );
  assert.deepEqual(
    studioCommandDispatchPlan({
      requestRevision: 4,
      currentRevision: 4,
      isVisible: true
    }),
    { type: "refresh" }
  );
});
