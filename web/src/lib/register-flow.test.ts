import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthCallbackUrl,
  buildAuthConfirmedUrl,
  buildCheckEmailUrl,
  validateRegistrationFields
} from "./register-flow.ts";

test("registration requires matching password confirmation", () => {
  assert.deepEqual(
    validateRegistrationFields({
      email: "new@example.com",
      password: "123456",
      passwordConfirmation: "654321",
      next: "/pets"
    }),
    {
      ok: false,
      message: "两次输入的密码不一致",
      next: "/pets"
    }
  );
});

test("registration normalizes a valid form", () => {
  assert.deepEqual(
    validateRegistrationFields({
      email: " New@Example.COM ",
      password: "123456",
      passwordConfirmation: "123456",
      referralCode: " lizi20 ",
      next: "//evil.example"
    }),
    {
      ok: true,
      email: "new@example.com",
      password: "123456",
      referralCode: "lizi20",
      next: "/"
    }
  );
});

test("auth callback and status URLs keep safe next paths", () => {
  assert.equal(
    buildAuthCallbackUrl("https://app.example.com", "/pets?tab=billing"),
    "https://app.example.com/auth/callback?next=%2Fpets%3Ftab%3Dbilling"
  );
  assert.equal(
    buildAuthConfirmedUrl("https://app.example.com", "success", "/pets"),
    "https://app.example.com/auth/confirmed?status=success&next=%2Fpets"
  );
  assert.equal(
    buildAuthConfirmedUrl("https://app.example.com", "error", "https://evil.example"),
    "https://app.example.com/auth/confirmed?status=error"
  );
});

test("check email URL includes the normalized email address", () => {
  assert.equal(
    buildCheckEmailUrl("https://app.example.com", "NEW@Example.COM", "/"),
    "https://app.example.com/auth/check-email?email=new%40example.com"
  );
});
