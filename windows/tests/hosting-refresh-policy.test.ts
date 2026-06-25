import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appSource = readFileSync(
  fileURLToPath(new URL("../src/main/app.ts", import.meta.url)),
  "utf8"
);

test("does not poll friend hosting requests in the Windows main process", () => {
  assert.doesNotMatch(appSource, /friendHostingPollingIntervalMs/);
  assert.doesNotMatch(appSource, /setInterval\(runBackgroundFriendRefresh/);
  assert.doesNotMatch(appSource, /startFriendHostingPolling/);
  assert.doesNotMatch(appSource, /stopFriendHostingPolling/);
});

test("does not refresh paused hosting requests from Windows realtime events", () => {
  assert.doesNotMatch(appSource, /action === "refreshHostingRequests"/);
  assert.doesNotMatch(appSource, /fetchHostingRequests\(account\.accessToken\)/);
  assert.doesNotMatch(appSource, /refreshHostingRequestCards/);
});

test("does not bootstrap paused hosting requests when the realtime stream starts", () => {
  const startFunctionIndex = appSource.indexOf("const startDesktopEventStream");
  const startupCallIndex = appSource.indexOf("if (settingsStore.currentAccount)");
  const startFunctionSource = appSource.slice(startFunctionIndex, startupCallIndex);

  assert.notEqual(startFunctionIndex, -1);
  assert.notEqual(startupCallIndex, -1);
  assert.doesNotMatch(startFunctionSource, /fetchHostingRequests/);
  assert.match(appSource, /startDesktopEventStream\(settingsStore\.currentAccount\)/);
});

test("starts a Windows desktop event stream instead of hosting request polling", () => {
  assert.match(appSource, /new DesktopEventStream/);
  assert.match(appSource, /startDesktopEventStream\(account\)/);
  assert.match(appSource, /stopDesktopEventStream\(\)/);
  assert.match(appSource, /desktopEventAction\(event\.type\)/);
});
