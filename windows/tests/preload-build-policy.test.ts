import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const viteConfigSource = readFileSync(
  fileURLToPath(new URL("../electron.vite.config.ts", import.meta.url)),
  "utf8"
);

test("builds the sandboxed preload bridge as CommonJS for Windows Electron", () => {
  assert.match(viteConfigSource, /format:\s*"cjs"/);
  assert.match(viteConfigSource, /entryFileNames:\s*"\[name\]\.cjs"/);
});
