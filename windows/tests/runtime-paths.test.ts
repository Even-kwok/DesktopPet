import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveRuntimePaths } from "../src/main/runtime-paths.ts";

test("resolves built preload and renderer file paths from main output directory", () => {
  const paths = resolveRuntimePaths(path.join("C:", "app", "out", "main"), "http://localhost:5173");

  assert.equal(paths.preloadPath, path.join("C:", "app", "out", "preload", "index.cjs"));
  assert.equal(paths.studioRendererFile, path.join("C:", "app", "out", "renderer", "index.html"));
  assert.equal(paths.petRendererFile, path.join("C:", "app", "out", "renderer", "pet.html"));
});

test("resolves Electron/Vite dev server HTML entry URLs", () => {
  const paths = resolveRuntimePaths(path.join("C:", "app", "out", "main"), "http://localhost:5173");

  assert.equal(paths.studioRendererURL, "http://localhost:5173/src/renderer/index.html");
  assert.equal(paths.petRendererURL, "http://localhost:5173/src/renderer/pet.html");
});
