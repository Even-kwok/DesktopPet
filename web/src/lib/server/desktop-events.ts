import type { DesktopEvent } from "../types.ts";

export const desktopEventStreamRetryMs = 3000;
export const desktopEventStreamPollMs = 2000;
export const desktopEventStreamHeartbeatMs = 15000;
export const desktopEventStreamMaxDurationMs = 240000;

export const desktopEventStreamHeaders = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no"
};

export function formatDesktopEventSseFrame(event: DesktopEvent) {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    "",
    ""
  ].join("\n");
}

export function formatDesktopEventSseHeartbeat() {
  return ": ping\n\n";
}

export function normalizeDesktopEventCursor(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return value;
}
