# Windows Download Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a testable Windows desktop client ZIP, expose it through the existing web download-card flow, and add a GitHub Actions artifact fallback for Windows testing.

**Architecture:** Keep the Windows app self-contained under `windows/`, using `electron-builder` only for packaging after the existing `electron-vite` build. Keep the web app unchanged at runtime because it already enables the Windows card from `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL`; document the Vercel upload/env flow instead of adding a storage backend now. Add one CI workflow that builds and uploads a Windows ZIP artifact from a real `windows-latest` runner and, on manual runs, updates a stable GitHub prerelease asset.

**Tech Stack:** Electron, electron-vite, electron-builder, Next.js environment variables, GitHub Actions, Vercel.

---

### Task 1: Windows ZIP Packaging

**Files:**
- Modify: `windows/package.json`
- Modify: `windows/package-lock.json`
- Test: `windows/tests/package-config.test.ts`

- [ ] **Step 1: Write the failing package-config test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Windows package exposes a reproducible x64 ZIP build", () => {
  assert.equal(packageJson.scripts["dist:win"], "npm run build && electron-builder --win zip --x64 --publish never");
  assert.equal(packageJson.build.productName, "CatDesktopPet");
  assert.equal(packageJson.build.appId, "com.catdesktoppet.windows");
  assert.equal(packageJson.build.artifactName, "CatDesktopPet-win-${arch}.${ext}");
  assert.deepEqual(packageJson.build.win.target, [{ target: "zip", arch: ["x64"] }]);
  assert.equal(packageJson.build.directories.output, "release");
  assert.ok(packageJson.devDependencies["electron-builder"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `windows/`: `node --experimental-strip-types --test tests/package-config.test.ts`

Expected: FAIL because `dist:win`, `build`, and `electron-builder` do not exist yet.

- [ ] **Step 3: Add the minimal packaging config**

Add `electron-builder` as a dev dependency, add a `dist:win` script, and add `build` metadata with `zip` x64 target and `release` output directory.

- [ ] **Step 4: Run test to verify it passes**

Run from `windows/`: `node --experimental-strip-types --test tests/package-config.test.ts`

Expected: PASS.

### Task 2: GitHub Actions Artifact

**Files:**
- Create: `.github/workflows/windows-desktop-artifact.yml`
- Test: `windows/tests/github-workflow.test.ts`

- [ ] **Step 1: Write the failing workflow test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/windows-desktop-artifact.yml", import.meta.url), "utf8");

test("Windows artifact workflow builds and uploads the packaged client", () => {
  assert.match(workflow, /runs-on:\s+windows-latest/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run from `windows/`: `node --experimental-strip-types --test tests/github-workflow.test.ts`

Expected: FAIL because the workflow file does not exist yet.

- [ ] **Step 3: Add the workflow**

Create `.github/workflows/windows-desktop-artifact.yml` that runs on manual dispatch and pushes affecting `windows/**`, installs Node 24, runs `npm ci`, `npm run typecheck`, `npm test`, `npm run dist:win`, uploads `windows/release/CatDesktopPet-win-x64.zip` as `cat-desktop-pet-windows-x64`, and publishes the same ZIP to the `windows-test` prerelease on manual runs.

- [ ] **Step 4: Run test to verify it passes**

Run from `windows/`: `node --experimental-strip-types --test tests/github-workflow.test.ts`

Expected: PASS.

### Task 3: Download And Vercel Release Docs

**Files:**
- Modify: `README.md`
- Modify: `web/README.md`
- Modify: `docs/deployment.md`
- Test: `web/src/lib/studio-layout.test.ts`

- [ ] **Step 1: Confirm existing web download-card behavior**

Run from `web/`: `npm run test:unit`

Expected: PASS, including `buildClientPlatformCards` coverage for Windows download URL.

- [ ] **Step 2: Document the release flow**

Document:

```text
cd windows
npm ci
npm run dist:win
```

Then upload `windows/release/CatDesktopPet-win-x64.zip` to a public URL, or manually run the workflow to publish `https://github.com/Even-kwok/DesktopPet/releases/download/windows-test/CatDesktopPet-win-x64.zip`, set `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL` in Vercel production, redeploy `web`, and verify the Windows card says `可下载`.

- [ ] **Step 3: Verify web and Windows**

Run:

```bash
cd windows && npm run typecheck && npm test && npm run build
cd web && npm run lint && npm run test:unit && npm run build
git diff --check
```

Expected: all pass.

### Task 4: Deploy Or Prepare Vercel

**Files:**
- No source files beyond docs/config.

- [ ] **Step 1: Build a Windows ZIP locally if possible**

Run from `windows/`: `npm run dist:win`

Expected: `windows/release/*.zip` exists. If local macOS cross-package fails, use the GitHub Actions artifact from `windows-latest`.

- [ ] **Step 2: Set the Vercel Windows download URL**

Use the public ZIP URL as `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL` in Vercel production.

- [ ] **Step 3: Deploy web to Vercel production**

Run from `web/`: `vercel deploy --prod`

Expected: a production deployment URL. Verify the page renders the Windows download button.
