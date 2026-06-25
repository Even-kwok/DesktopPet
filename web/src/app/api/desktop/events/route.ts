import { NextResponse } from "next/server";
import { listAccountDesktopEvents } from "@/lib/server/account-data-store";
import { getDesktopAuthContext } from "@/lib/server/desktop-auth";
import { normalizeDesktopEventCursor } from "@/lib/server/desktop-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  const auth = await getDesktopAuthContext(request);

  if (!auth.user) {
    return NextResponse.json({ error: "DESKTOP_AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const after = normalizeDesktopEventCursor(url.searchParams.get("after"));
  const events = await listAccountDesktopEvents(auth.user, after);

  return NextResponse.json({
    events,
    cursor: events.at(-1)?.id ?? after
  });
}
