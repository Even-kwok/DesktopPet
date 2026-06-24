import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createDesktopLoginSession, getDesktopAuthContext } from "./desktop-auth.ts";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("desktop auth accepts server-signed desktop tokens when Supabase auth is configured", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.AUTH_MOCK_COOKIE_SECRET = "desktop-test-secret";
  const token = signDesktopToken({
    id: "00000000-0000-4000-8000-000000000001",
    name: "栗子主人",
    email: "demo@desktop.pet",
    credits: 0,
    purpose: "desktop",
    issuedAt: "2026-06-18T00:00:00.000Z",
    expiresAt: "2026-06-25T00:00:00.000Z"
  });

  const auth = await getDesktopAuthContext(
    new Request("https://example.com/api/desktop/pets", {
      headers: {
        authorization: `Bearer ${token}`
      }
    })
  );

  assert.equal(auth.mode, "supabase");
  assert.deepEqual(auth.user, {
    id: "00000000-0000-4000-8000-000000000001",
    name: "栗子主人",
    email: "demo@desktop.pet",
    credits: 0
  });
});

test("desktop login returns a long-lived desktop token instead of the Supabase access token", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.AUTH_MOCK_COOKIE_SECRET = "desktop-test-secret";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        access_token: "short-supabase-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "refresh-token",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "demo@desktop.pet",
          app_metadata: {},
          user_metadata: {
            display_name: "栗子主人"
          }
        }
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );

  try {
    const session = await createDesktopLoginSession({
      email: "demo@desktop.pet",
      password: "123456"
    });

    assert.ok(session);
    assert.notEqual(session.accessToken, "short-supabase-token");
    assert.equal(session.expiresIn, 60 * 60 * 24 * 14);

    const auth = await getDesktopAuthContext(
      new Request("https://example.com/api/desktop/pets", {
        headers: {
          authorization: `Bearer ${session.accessToken}`
        }
      })
    );

    assert.equal(auth.user?.email, "demo@desktop.pet");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("desktop login does not bypass Supabase for the demo account when auth is configured", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.AUTH_MOCK_COOKIE_SECRET = "desktop-test-secret";
  const originalFetch = globalThis.fetch;
  let didCallSupabase = false;
  globalThis.fetch = async () => {
    didCallSupabase = true;
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 400 });
  };

  try {
    const session = await createDesktopLoginSession({
      email: "demo@desktop.pet",
      password: "123456"
    });

    assert.equal(session, null);
    assert.equal(didCallSupabase, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function signDesktopToken(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", "desktop-test-secret")
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}
