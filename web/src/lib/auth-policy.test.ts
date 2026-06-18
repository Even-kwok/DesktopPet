import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminUser,
  sanitizeRedirectPath,
  toCurrentUser
} from "./auth-policy.ts";

test("admin auth trusts app metadata and server email allowlist, not user metadata", () => {
  assert.equal(
    isAdminUser({
      id: "user_fake_admin",
      email: "fake-admin@desktop.pet",
      appMetadata: {},
      userMetadata: { role: "admin", is_admin: true }
    }),
    false
  );

  assert.equal(
    isAdminUser({
      id: "user_app_admin",
      email: "app-admin@desktop.pet",
      appMetadata: { role: "admin" },
      userMetadata: {}
    }),
    true
  );

  assert.equal(
    isAdminUser(
      {
        id: "user_allowlisted",
        email: "ops@desktop.pet",
        appMetadata: {},
        userMetadata: {}
      },
      "owner@desktop.pet, ops@desktop.pet"
    ),
    true
  );
});

test("login redirects only allow local paths", () => {
  assert.equal(sanitizeRedirectPath("/admin?tab=materials", "/"), "/admin?tab=materials");
  assert.equal(sanitizeRedirectPath("https://evil.example/login", "/"), "/");
  assert.equal(sanitizeRedirectPath("//evil.example/login", "/"), "/");
  assert.equal(sanitizeRedirectPath("/\n/admin", "/"), "/");
});

test("current user mapping uses profile metadata for display only", () => {
  assert.deepEqual(
    toCurrentUser({
      id: "user_123",
      email: "mika@desktop.pet",
      appMetadata: { role: "admin" },
      userMetadata: { display_name: "Mika" }
    }),
    {
      id: "user_123",
      name: "Mika",
      email: "mika@desktop.pet",
      credits: 0
    }
  );
});
