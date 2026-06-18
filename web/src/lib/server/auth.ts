import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { currentUser } from "@/lib/mock-data";
import { isAdminUser, sanitizeRedirectPath, toCurrentUser, type AuthPolicyUser } from "@/lib/auth-policy";
import { getBackendStatus } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";

export const mockAuthCookieName = "catdesktoppet_mock_auth";

export type AuthContext = {
  mode: "mock" | "supabase";
  authConfigured: boolean;
  user: CurrentUser | null;
  isAdmin: boolean;
  supabaseUser?: User | null;
};

export type SignedInAuthContext = AuthContext & {
  user: CurrentUser;
};

type MockSession = CurrentUser & {
  role: "user" | "admin";
  issuedAt: string;
};

export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The proxy refresh path handles it.
        }
      }
    }
  });
}

export async function getCurrentAuthContext(): Promise<AuthContext> {
  const backend = getBackendStatus();

  if (backend.authConfigured) {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return emptyAuthContext(true);
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return emptyAuthContext(true);
    }

    const policyUser = toPolicyUser(data.user);

    return {
      mode: "supabase",
      authConfigured: true,
      user: toCurrentUser(policyUser),
      isAdmin: isAdminUser(policyUser),
      supabaseUser: data.user
    };
  }

  const mockSession = await readMockSession();

  return {
    mode: "mock",
    authConfigured: false,
    user: mockSession ? toPublicMockUser(mockSession) : null,
    isAdmin: mockSession?.role === "admin",
    supabaseUser: null
  };
}

export async function requireUserPage(nextPath = "/"): Promise<SignedInAuthContext> {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    redirect(`/login?next=${encodeURIComponent(sanitizeRedirectPath(nextPath, "/"))}`);
  }

  return auth as SignedInAuthContext;
}

export async function requireAdminPage(nextPath = "/admin"): Promise<SignedInAuthContext> {
  const auth = await getCurrentAuthContext();

  if (!auth.user || !auth.isAdmin) {
    redirect(`/admin/login?next=${encodeURIComponent(sanitizeRedirectPath(nextPath, "/admin"))}`);
  }

  return auth as SignedInAuthContext;
}

export async function signOutCurrentSession() {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  await clearMockSession();
}

export async function writeMockSession(role: "user" | "admin") {
  const cookieStore = await cookies();
  const session =
    role === "admin"
      ? {
          id: "admin_demo",
          name: "后台管理员",
          email: "admin@desktop.pet",
          credits: 0,
          role,
          issuedAt: new Date().toISOString()
        }
      : {
          ...currentUser,
          role,
          issuedAt: new Date().toISOString()
        };

  cookieStore.set(mockAuthCookieName, signMockSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function clearMockSession() {
  const cookieStore = await cookies();

  cookieStore.set(mockAuthCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function toPolicyUser(user: User): AuthPolicyUser {
  return {
    id: user.id,
    email: user.email,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata
  };
}

async function readMockSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(mockAuthCookieName)?.value;

  if (!value) {
    return null;
  }

  return verifyMockSession(value);
}

function emptyAuthContext(authConfigured: boolean): AuthContext {
  return {
    mode: authConfigured ? "supabase" : "mock",
    authConfigured,
    user: null,
    isAdmin: false,
    supabaseUser: null
  };
}

function toPublicMockUser(session: MockSession): CurrentUser {
  return {
    id: session.id,
    name: session.name,
    email: session.email,
    credits: session.credits
  };
}

function signMockSession(session: MockSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function verifyMockSession(value: string): MockSession | null {
  const [payload, signature] = value.split(".");

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MockSession;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.credits !== "number" ||
      (parsed.role !== "user" && parsed.role !== "admin")
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function signPayload(payload: string) {
  return createHmac("sha256", process.env.AUTH_MOCK_COOKIE_SECRET || "catdesktoppet-local-mock-auth")
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
