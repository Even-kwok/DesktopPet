import { listAccountDesktopEvents } from "@/lib/server/account-data-store";
import { getDesktopAuthContext } from "@/lib/server/desktop-auth";
import {
  desktopEventStreamHeaders,
  desktopEventStreamHeartbeatMs,
  desktopEventStreamMaxDurationMs,
  desktopEventStreamPollMs,
  desktopEventStreamRetryMs,
  formatDesktopEventSseFrame,
  formatDesktopEventSseHeartbeat,
  normalizeDesktopEventCursor
} from "@/lib/server/desktop-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  const auth = await getDesktopAuthContext(request);

  if (!auth.user) {
    return Response.json({ error: "DESKTOP_AUTH_REQUIRED" }, { status: 401 });
  }

  const account = auth.user;
  const url = new URL(request.url);
  let cursor = normalizeDesktopEventCursor(
    url.searchParams.get("after") ?? request.headers.get("last-event-id")
  );
  const encoder = new TextEncoder();
  let closed = false;

  request.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let lastHeartbeatAt = 0;

      controller.enqueue(encoder.encode(`retry: ${desktopEventStreamRetryMs}\n\n`));

      while (!closed && Date.now() - startedAt < desktopEventStreamMaxDurationMs) {
        const events = await listAccountDesktopEvents(account, cursor);

        if (events.length > 0) {
          for (const event of events) {
            controller.enqueue(encoder.encode(formatDesktopEventSseFrame(event)));
            cursor = event.id;
          }
        } else if (Date.now() - lastHeartbeatAt >= desktopEventStreamHeartbeatMs) {
          controller.enqueue(encoder.encode(formatDesktopEventSseHeartbeat()));
          lastHeartbeatAt = Date.now();
        }

        await sleep(desktopEventStreamPollMs);
      }

      controller.close();
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: desktopEventStreamHeaders
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
