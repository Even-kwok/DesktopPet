import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowUrl = new URL("../../.github/workflows/windows-desktop-artifact.yml", import.meta.url);

test("Windows artifact workflow builds and uploads the packaged client", () => {
  assert.equal(existsSync(workflowUrl), true);

  const workflow = readFileSync(workflowUrl, "utf8");
  assert.match(workflow, /runs-on:\s+windows-latest/);
  assert.match(workflow, /contents:\s+write/);
  assert.match(workflow, /working-directory:\s+windows/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run dist:win/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /path:\s+windows\/release\/CatDesktopPet-win-x64\.zip/);
  assert.match(workflow, /gh release view windows-test/);
  assert.match(workflow, /gh release upload windows-test release\/CatDesktopPet-win-x64\.zip --clobber/);
});
