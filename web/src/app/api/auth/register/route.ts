import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
import { provisionSupabaseAccount } from "@/lib/server/account-provisioning";
import { createSupabaseServerClient, writeMockSession } from "@/lib/server/auth";
import {
  recordUserReferralAtRegistration,
  resolveActiveReferralCode
} from "@/lib/server/referral-store";
import { getBackendStatus } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const referralCode = String(form.get("referralCode") ?? "").trim();
  const next = sanitizeRedirectPath(String(form.get("next") ?? "/"), "/");
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return redirectWithMessage(origin, "error", "请输入邮箱和密码", next);
  }

  if (password.length < 6) {
    return redirectWithMessage(origin, "error", "密码至少 6 位", next);
  }

  if (referralCode) {
    try {
      await resolveActiveReferralCode(referralCode);
    } catch {
      return redirectWithMessage(origin, "error", "推荐码无效或已停用", next);
    }
  }

  if (!getBackendStatus().authConfigured) {
    await writeMockSession("user");
    return redirectWithMessage(origin, "notice", "预览模式已用测试账号进入工作台。", next);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return redirectWithMessage(origin, "error", "注册服务未配置", next);
  }

  const displayName = email.split("@")[0] || "DesktopPet 用户";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error || !data.user) {
    return redirectWithMessage(origin, "error", "注册失败，这个邮箱可能已经注册。", next);
  }

  try {
    await provisionSupabaseAccount({
      userId: data.user.id,
      email: data.user.email ?? email,
      displayName
    });

    if (referralCode) {
      await recordUserReferralAtRegistration({
        referredUserId: data.user.id,
        referralCode
      });
    }
  } catch {
    return redirectWithMessage(origin, "error", "账号已创建，但初始化工作台失败，请联系管理员。", next);
  }

  if (!data.session) {
    return redirectWithMessage(origin, "notice", "注册成功，请检查邮箱或直接登录。", next);
  }

  return NextResponse.redirect(new URL(next, origin), { status: 303 });
}

function redirectWithMessage(origin: string, key: "error" | "notice", message: string, next: string) {
  const url = new URL("/", origin);
  url.searchParams.set(key, message);
  url.searchParams.set("next", next);

  return NextResponse.redirect(url, { status: 303 });
}
