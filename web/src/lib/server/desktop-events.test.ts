import test from "node:test";
import assert from "node:assert/strict";
import {
  desktopEventStreamHeaders,
  desktopEventStreamRetryMs,
  formatDesktopEventSseFrame,
  formatDesktopEventSseHeartbeat,
  normalizeDesktopEventCursor
} from "./desktop-events.ts";
import type { DesktopEvent } from "../types.ts";

const event: DesktopEvent = {
  id: "42",
  userId: "user_demo",
  type: "hosting_request_created",
  actorUserId: "friend_1",
  petId: "pet_orange",
  hostingRequestId: "hosting_1",
  createdAt: "2026-06-25T00:00:00.000Z"
};

test("desktop event SSE frames include id, named event, and JSON payload", () => {
  assert.equal(
    formatDesktopEventSseFrame(event),
    [
      "id: 42",
      "event: hosting_request_created",
      `data: ${JSON.stringify(event)}`,
      "",
      ""
    ].join("\n")
  );
});

test("desktop event SSE heartbeat is a comment frame", () => {
  assert.equal(formatDesktopEventSseHeartbeat(), ": ping\n\n");
});

test("desktop event stream headers disable buffering and caching", () => {
  assert.equal(desktopEventStreamHeaders["Content-Type"], "text/event-stream; charset=utf-8");
  assert.equal(desktopEventStreamHeaders["Cache-Control"], "no-cache, no-transform");
  assert.equal(desktopEventStreamHeaders["X-Accel-Buffering"], "no");
});

test("desktop event cursors only accept nonnegative integer strings", () => {
  assert.equal(normalizeDesktopEventCursor("42"), "42");
  assert.equal(normalizeDesktopEventCursor("0"), "0");
  assert.equal(normalizeDesktopEventCursor("-1"), null);
  assert.equal(normalizeDesktopEventCursor("abc"), null);
  assert.equal(normalizeDesktopEventCursor(null), null);
});

test("desktop event stream retry is short enough for app-like reconnects", () => {
  assert.equal(desktopEventStreamRetryMs, 3000);
});
