import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
import { buildAuthConfirmedUrl } from "@/lib/register-flow";
import { provisionSupabaseAccount } from "@/lib/server/account-provisioning";
import { createSupabaseServerClient } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const next = sanitizeRedirectPath(requestUrl.searchParams.get("next"), "/");
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToConfirmed(origin, "error", next);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return redirectToConfirmed(origin, "error", next);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToConfirmed(origin, "error", next);
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (user?.id && user.email) {
    try {
      await provisionSupabaseAccount({
        userId: user.id,
        email: user.email,
        displayName: cleanDisplayName(user.user_metadata?.display_name)
      });
    } catch {
      return redirectToConfirmed(origin, "error", next);
    }
  }

  return redirectToConfirmed(origin, "success", next);
}

function redirectToConfirmed(origin: string, status: "success" | "error", next: string) {
  return NextResponse.redirect(buildAuthConfirmedUrl(origin, status, next), { status: 303 });
}

function cleanDisplayName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
