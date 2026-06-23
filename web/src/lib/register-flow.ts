import { sanitizeRedirectPath } from "./auth-policy.ts";

export type RegistrationValidation =
  | {
      ok: true;
      email: string;
      password: string;
      referralCode: string;
      next: string;
    }
  | {
      ok: false;
      message: string;
      next: string;
    };

type RegistrationInput = {
  email: unknown;
  password: unknown;
  passwordConfirmation: unknown;
  referralCode?: unknown;
  next?: unknown;
};

export function validateRegistrationFields(input: RegistrationInput): RegistrationValidation {
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const passwordConfirmation = String(input.passwordConfirmation ?? "");
  const referralCode = String(input.referralCode ?? "").trim();
  const next = sanitizeRedirectPath(String(input.next ?? "/"), "/");

  if (!email || !password || !passwordConfirmation) {
    return { ok: false, message: "请输入邮箱、密码和确认密码", next };
  }

  if (password !== passwordConfirmation) {
    return { ok: false, message: "两次输入的密码不一致", next };
  }

  if (password.length < 6) {
    return { ok: false, message: "密码至少 6 位", next };
  }

  return { ok: true, email, password, referralCode, next };
}

export function buildAuthCallbackUrl(origin: string, next: string) {
  const url = new URL("/auth/callback", origin);
  const safeNext = sanitizeRedirectPath(next, "/");

  if (safeNext !== "/") {
    url.searchParams.set("next", safeNext);
  }

  return url.toString();
}

export function buildAuthConfirmedUrl(origin: string, status: "success" | "error", next: string) {
  const url = new URL("/auth/confirmed", origin);
  const safeNext = sanitizeRedirectPath(next, "/");

  url.searchParams.set("status", status);

  if (safeNext !== "/") {
    url.searchParams.set("next", safeNext);
  }

  return url.toString();
}

export function buildCheckEmailUrl(origin: string, email: string, next: string) {
  const url = new URL("/auth/check-email", origin);
  const safeNext = sanitizeRedirectPath(next, "/");

  url.searchParams.set("email", email.trim().toLowerCase());

  if (safeNext !== "/") {
    url.searchParams.set("next", safeNext);
  }

  return url.toString();
}
