import test from "node:test";
import assert from "node:assert/strict";
import {
  desktopEventAction,
  parseDesktopEventStreamChunk
} from "../src/main/desktop-event-stream.ts";

test("parses complete desktop SSE event frames", () => {
  const event = {
    id: "7",
    userId: "user_demo",
    type: "hosting_request_created",
    actorUserId: "friend_1",
    petId: "pet_orange",
    hostingRequestId: "hosting_1",
    createdAt: "2026-06-25T00:00:00.000Z"
  };

  const result = parseDesktopEventStreamChunk("", [
    "id: 7",
    "event: hosting_request_created",
    `data: ${JSON.stringify(event)}`,
    "",
    ""
  ].join("\n"));

  assert.equal(result.buffer, "");
  assert.deepEqual(result.events, [event]);
});

test("keeps partial desktop SSE frames until the next chunk", () => {
  const first = parseDesktopEventStreamChunk("", "id: 8\nevent: pet_recalled\n");
  const second = parseDesktopEventStreamChunk(first.buffer, [
    `data: ${JSON.stringify({
      id: "8",
      userId: "user_demo",
      type: "pet_recalled",
      actorUserId: "user_demo",
      petId: "pet_orange",
      hostingRequestId: "hosting_1",
      createdAt: "2026-06-25T00:00:00.000Z"
    })}`,
    "",
    ""
  ].join("\n"));

  assert.deepEqual(first.events, []);
  assert.equal(second.events[0]?.type, "pet_recalled");
  assert.equal(second.buffer, "");
});

test("ignores comments, retry frames, and malformed desktop event data", () => {
  const result = parseDesktopEventStreamChunk("", [
    ": ping",
    "",
    "retry: 3000",
    "",
    "id: bad",
    "event: hosting_request_created",
    "data: not-json",
    "",
    ""
  ].join("\n"));

  assert.deepEqual(result.events, []);
});

test("maps desktop events to the minimal Windows client action", () => {
  assert.equal(desktopEventAction("hosting_request_created"), null);
  assert.equal(desktopEventAction("hosting_request_declined"), null);
  assert.equal(desktopEventAction("hosting_request_accepted"), "syncDesktopBundle");
  assert.equal(desktopEventAction("pet_recalled"), "syncDesktopBundle");
  assert.equal(desktopEventAction("desktop_bundle_changed"), "syncDesktopBundle");
  assert.equal(desktopEventAction("unknown"), null);
});
