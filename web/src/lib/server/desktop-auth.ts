import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";
import { currentUser } from "../mock-data.ts";
import { toCurrentUser } from "../auth-policy.ts";
import { getBackendStatus } from "../supabase/server.ts";
import type { CurrentUser, DesktopLoginResponse } from "../types.ts";

type DesktopTokenPayload = CurrentUser & {
  purpose: "desktop";
  issuedAt: string;
  expiresAt: string;
};

export type DesktopAuthContext = {
  mode: "mock" | "supabase";
  user: CurrentUser | null;
};

const desktopTokenMaxAgeSeconds = 60 * 60 * 24 * 14;

export async function createDesktopLoginSession(input: {
  email: string;
  password: string;
}): Promise<DesktopLoginResponse | null> {
  const backend = getBackendStatus();

  if (isDemoDesktopLogin(input)) {
    return demoDesktopLoginSession();
  }

  if (!backend.authConfigured) {
    return null;
  }

  const supabase = createDesktopSupabaseAuthClient();

  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (error || !data.session || !data.user) {
    return null;
  }

  const account = toCurrentUser(toPolicyUser(data.user));

  return {
    mode: "supabase",
    tokenType: "bearer",
    accessToken: signDesktopToken(account),
    expiresIn: desktopTokenMaxAgeSeconds,
    account
  };
}

function isDemoDesktopLogin(input: { email: string; password: string }) {
  return input.email === "demo@desktop.pet" && input.password === "123456";
}

function demoDesktopLoginSession(): DesktopLoginResponse {
  return {
    mode: "mock",
    tokenType: "bearer",
    accessToken: signDesktopToken(currentUser),
    expiresIn: desktopTokenMaxAgeSeconds,
    account: currentUser
  };
}

export async function getDesktopAuthContext(request: Request): Promise<DesktopAuthContext> {
  const token = bearerTokenFromRequest(request);
  const backend = getBackendStatus();

  if (!token) {
    return {
      mode: backend.authConfigured ? "supabase" : "mock",
      user: null
    };
  }

  const desktopTokenUser = verifyDesktopToken(token);

  if (desktopTokenUser) {
    return {
      mode: backend.authConfigured ? "supabase" : "mock",
      user: desktopTokenUser
    };
  }

  if (!backend.authConfigured) {
    return {
      mode: "mock",
      user: null
    };
  }

  const supabase = createDesktopSupabaseAuthClient();

  if (!supabase) {
    return {
      mode: "supabase",
      user: null
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      mode: "supabase",
      user: null
    };
  }

  return {
    mode: "supabase",
    user: toCurrentUser(toPolicyUser(data.user))
  };
}

function bearerTokenFromRequest(request: Request) {
  const value = request.headers.get("authorization");

  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(/\s+/, 2);

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function createDesktopSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function toPolicyUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata
  };
}

function signDesktopToken(account: CurrentUser) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + desktopTokenMaxAgeSeconds * 1000);
  const payload: DesktopTokenPayload = {
    ...account,
    purpose: "desktop",
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function verifyDesktopToken(value: string): CurrentUser | null {
  const [payload, signature] = value.split(".");

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DesktopTokenPayload;
    const expiresAt = Date.parse(parsed.expiresAt);

    if (
      parsed.purpose !== "desktop" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.credits !== "number"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      credits: parsed.credits
    };
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
