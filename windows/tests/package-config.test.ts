import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Windows package exposes a reproducible x64 ZIP build", () => {
  assert.equal(packageJson.version, "0.1.2");
  assert.equal(
    packageJson.scripts["dist:win"],
    "npm run build && electron-builder --win zip --x64 --publish never"
  );
  assert.equal(packageJson.build.productName, "CatDesktopPet");
  assert.equal(packageJson.build.appId, "com.catdesktoppet.windows");
  assert.equal(packageJson.build.artifactName, "CatDesktopPet-win-${arch}.${ext}");
  assert.deepEqual(packageJson.build.win.target, [{ target: "zip", arch: ["x64"] }]);
  assert.equal(packageJson.build.directories.output, "release");
  assert.ok(packageJson.devDependencies["electron-builder"]);
});
