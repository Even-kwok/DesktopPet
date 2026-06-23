import { NextResponse } from "next/server";
import {
  buildAuthCallbackUrl,
  buildAuthConfirmedUrl,
  buildCheckEmailUrl,
  validateRegistrationFields
} from "@/lib/register-flow";
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
  const origin = new URL(request.url).origin;
  const registration = validateRegistrationFields({
    email: form.get("email"),
    password: form.get("password"),
    passwordConfirmation: form.get("passwordConfirmation"),
    referralCode: form.get("referralCode"),
    next: form.get("next")
  });

  if (!registration.ok) {
    return redirectWithMessage(origin, "error", registration.message, registration.next, "register");
  }

  const { email, password, referralCode, next } = registration;

  if (referralCode) {
    try {
      await resolveActiveReferralCode(referralCode);
    } catch {
      return redirectWithMessage(origin, "error", "推荐码无效或已停用", next, "register");
    }
  }

  if (!getBackendStatus().authConfigured) {
    await writeMockSession("user");
    return redirectWithMessage(origin, "notice", "预览模式已用测试账号进入工作台。", next);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return redirectWithMessage(origin, "error", "注册服务未配置", next, "register");
  }

  const displayName = email.split("@")[0] || "DesktopPet 用户";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(origin, next),
      data: {
        display_name: displayName
      }
    }
  });

  if (error || !data.user) {
    return redirectWithMessage(origin, "error", "注册失败，这个邮箱可能已经注册。", next, "register");
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
    return redirectWithMessage(
      origin,
      "error",
      "账号已创建，但初始化工作台失败，请联系管理员。",
      next,
      "register"
    );
  }

  if (!data.session) {
    return NextResponse.redirect(buildCheckEmailUrl(origin, email, next), { status: 303 });
  }

  return NextResponse.redirect(buildAuthConfirmedUrl(origin, "success", next), { status: 303 });
}

function redirectWithMessage(
  origin: string,
  key: "error" | "notice",
  message: string,
  next: string,
  auth?: "login" | "register"
) {
  const url = new URL("/", origin);
  url.searchParams.set(key, message);
  url.searchParams.set("next", next);

  if (auth) {
    url.searchParams.set("auth", auth);
  }

  return NextResponse.redirect(url, { status: 303 });
}
