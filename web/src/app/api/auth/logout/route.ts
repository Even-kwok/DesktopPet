import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
import { signOutCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const next = sanitizeRedirectPath(String(form?.get("next") ?? "/"), "/");
  const origin = new URL(request.url).origin;

  await signOutCurrentSession();

  return NextResponse.redirect(new URL(next, origin), { status: 303 });
}
