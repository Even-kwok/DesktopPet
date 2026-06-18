import { NextResponse } from "next/server";
import { isAdminUser, sanitizeRedirectPath } from "@/lib/auth-policy";
import {
  createSupabaseServerClient,
  toPolicyUser,
  writeMockSession
} from "@/lib/server/auth";
import { getBackendStatus } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = sanitizeRedirectPath(String(form.get("next") ?? "/admin"), "/admin");
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return redirectWithError(origin, "请输入后台账号和密码", next);
  }

  if (!getBackendStatus().authConfigured) {
    if (email !== "admin@desktop.pet" || password !== "123456") {
      return redirectWithError(origin, "测试后台账号或密码不正确", next);
    }

    await writeMockSession("admin");
    return NextResponse.redirect(new URL(next, origin), { status: 303 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return redirectWithError(origin, "后台登录服务未配置", next);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return redirectWithError(origin, "后台账号或密码不正确", next);
  }

  if (!isAdminUser(toPolicyUser(data.user))) {
    await supabase.auth.signOut();
    return redirectWithError(origin, "该账号没有后台权限", next);
  }

  return NextResponse.redirect(new URL(next, origin), { status: 303 });
}

function redirectWithError(origin: string, error: string, next: string) {
  const url = new URL("/admin/login", origin);
  url.searchParams.set("error", error);
  url.searchParams.set("next", next);

  return NextResponse.redirect(url, { status: 303 });
}
