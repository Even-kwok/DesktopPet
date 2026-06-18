import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
import { createSupabaseServerClient, writeMockSession } from "@/lib/server/auth";
import { getBackendStatus } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = sanitizeRedirectPath(String(form.get("next") ?? "/"), "/");
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return redirectWithError(origin, "请输入邮箱和密码", next);
  }

  if (!getBackendStatus().authConfigured) {
    if (email !== "demo@desktop.pet" || password !== "123456") {
      return redirectWithError(origin, "测试账号或密码不正确", next);
    }

    await writeMockSession("user");
    return NextResponse.redirect(new URL(next, origin), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return redirectWithError(origin, "登录服务未配置", next);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirectWithError(origin, "邮箱或密码不正确", next);
  }

  return NextResponse.redirect(new URL(next, origin), { status: 303 });
}

function redirectWithError(origin: string, error: string, next: string) {
  const url = new URL("/", origin);
  url.searchParams.set("error", error);
  url.searchParams.set("next", next);

  return NextResponse.redirect(url, { status: 303 });
}
