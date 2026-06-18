import { getCurrentAuthContext } from "@/lib/server/auth";
import { getDesktopAuthContext } from "@/lib/server/desktop-auth";
import type { CurrentUser } from "@/lib/types";

export async function getRequestAccount(request: Request): Promise<CurrentUser | null> {
  const desktopAuth = await getDesktopAuthContext(request);

  if (desktopAuth.user) {
    return desktopAuth.user;
  }

  const webAuth = await getCurrentAuthContext();

  return webAuth.user;
}
