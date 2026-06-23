import assert from "node:assert/strict";
import test from "node:test";
import { studioRendererLoadTarget } from "../src/main/studio-window-policy.ts";

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
      currentURL: "file:///app/out/renderer/index.html",
      studioRendererFile: rendererFile
    }),
    { type: "none" }
  );
});
