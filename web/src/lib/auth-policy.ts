import type { CurrentUser } from "@/lib/types";

export type AuthPolicyUser = {
  id: string;
  email?: string | null;
  appMetadata?: Record<string, unknown> | null;
  userMetadata?: Record<string, unknown> | null;
};

export function isAdminUser(user: AuthPolicyUser | null | undefined, adminEmails = process.env.ADMIN_EMAILS) {
  if (!user) {
    return false;
  }

  const appMetadata = user.appMetadata ?? {};
  const roles = appMetadata.roles;
  const appRole = appMetadata.role;
  const appIsAdmin = appMetadata.is_admin;

  if (appRole === "admin" || appIsAdmin === true) {
    return true;
  }

  if (Array.isArray(roles) && roles.includes("admin")) {
    return true;
  }

  const email = user.email?.trim().toLowerCase();
  const allowlist = parseAdminEmails(adminEmails);

  return Boolean(email && allowlist.has(email));
}

export function parseAdminEmails(adminEmails = "") {
  return new Set(
    adminEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function sanitizeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\r\n]/.test(value)) {
    return fallback;
  }

  return value;
}

export function toCurrentUser(user: AuthPolicyUser, credits = 0): CurrentUser {
  const userMetadata = user.userMetadata ?? {};
  const displayName = firstString(
    userMetadata.display_name,
    userMetadata.full_name,
    userMetadata.name
  );
  const email = user.email ?? "";

  return {
    id: user.id,
    name: displayName || email.split("@")[0] || "DesktopPet 用户",
    email,
    credits
  };
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}
